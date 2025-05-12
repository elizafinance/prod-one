import { AuthOptions, User as NextAuthUser, Account, Profile } from "next-auth";
import { JWT } from "next-auth/jwt";
import TwitterProvider from "next-auth/providers/twitter";
import { connectToDatabase, UserDocument, ActionDocument } from "@/lib/mongodb"; // Assuming mongodb.ts is also in @/lib
import { randomBytes } from 'crypto';
import { Db } from 'mongodb';

const POINTS_INITIAL_CONNECTION = 100; // Make sure this constant is accessible or redefined if needed locally

// This function is used by authOptions, so it needs to be here or imported.
async function generateUniqueReferralCode(db: Db, length = 8): Promise<string> {
  const usersCollection = db.collection<UserDocument>('users');
  let referralCode = '';
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;
  while (!isUnique && attempts < maxAttempts) {
    referralCode = randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
    const existingUser = await usersCollection.findOne({ referralCode });
    if (!existingUser) {
      isUnique = true;
    }
    attempts++;
  }
  if (!isUnique) {
    console.warn(`Could not generate unique referral code in NextAuth setup after ${maxAttempts} attempts. Appending random chars.`);
    return referralCode + randomBytes(2).toString('hex'); 
  }
  return referralCode;
}

interface TwitterProfile extends Profile { // Keep this interface definition with authOptions
    id_str?: string;
    screen_name?: string;
    profile_image_url_https?: string;
}

export const authOptions: AuthOptions = {
  providers: [
    TwitterProvider({
      clientId: process.env.X_CLIENT_ID!,
      clientSecret: process.env.X_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account, profile }: { user: NextAuthUser, account: Account | null, profile?: Profile | TwitterProfile }) {
      console.log("[NextAuth SignIn] Received data:", { user, account, profile });
      if (account?.provider === "twitter" && profile) {
        const twitterProfile = profile as TwitterProfile;
        console.log("[NextAuth SignIn] Processing Twitter profile:", twitterProfile);
        try {
          const { db } = await connectToDatabase();
          console.log("[NextAuth SignIn] Connected to database.");
          const usersCollection = db.collection<UserDocument>('users');
          const actionsCollection = db.collection<ActionDocument>('actions');

          const xUserId = twitterProfile.id_str || user.id;
          console.log("[NextAuth SignIn] Extracted xUserId:", xUserId);

          if (!xUserId) {
            console.error('[NextAuth SignIn] X User ID not found in profile. Denying access.');
            return false;
          }

          (user as any).xId = xUserId;
          let determinedWalletAddress: string | undefined = undefined;

          let dbUser = await usersCollection.findOne({ xUserId });
          console.log("[NextAuth SignIn] Found dbUser:", dbUser);

          if (!dbUser) {
            console.log("[NextAuth SignIn] User not found in DB, creating new user for xUserId:", xUserId);
            const newReferralCode = await generateUniqueReferralCode(db);
            const xUsername = twitterProfile.screen_name || user.name || undefined;
            const xProfileImageUrl = twitterProfile.profile_image_url_https || user.image || undefined;
            console.log("[NextAuth SignIn] New user details:", { newReferralCode, xUsername, xProfileImageUrl });

            determinedWalletAddress = xUserId;
            const newUserDocData: Omit<UserDocument, '_id'> = {
              xUserId: xUserId,
              walletAddress: determinedWalletAddress, 
              xUsername: xUsername,
              xProfileImageUrl: xProfileImageUrl,
              points: POINTS_INITIAL_CONNECTION,
              referralCode: newReferralCode,
              completedActions: ['initial_connection'],
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            console.log("[NextAuth SignIn] Inserting new user document:", newUserDocData);
            const result = await usersCollection.insertOne(newUserDocData as UserDocument);
            console.log("[NextAuth SignIn] New user insert result:", result);
            
            console.log("[NextAuth SignIn] Inserting initial_connection action for xUserId:", xUserId);
            await actionsCollection.insertOne({
                walletAddress: determinedWalletAddress, 
                actionType: 'initial_connection',
                pointsAwarded: POINTS_INITIAL_CONNECTION,
                timestamp: new Date(),
                notes: `New user via X login: ${xUserId}`
            });
            console.log("[NextAuth SignIn] Action inserted.");
            (user as any).dbId = result.insertedId.toHexString();
            (user as any).walletAddress = determinedWalletAddress;
          } else {
            console.log("[NextAuth SignIn] User found in DB, updating for xUserId:", xUserId);
            (user as any).dbId = dbUser._id!.toHexString();
            determinedWalletAddress = dbUser.walletAddress || dbUser.xUserId;
            (user as any).walletAddress = determinedWalletAddress;
            const xUsername = twitterProfile.screen_name || user.name || undefined;
            const xProfileImageUrl = twitterProfile.profile_image_url_https || user.image || undefined;
            console.log("[NextAuth SignIn] Updating user with details:", { xUsername, xProfileImageUrl });
            await usersCollection.updateOne({ xUserId }, { $set: { 
              xUsername: xUsername,
              xProfileImageUrl: xProfileImageUrl, 
              walletAddress: determinedWalletAddress,
              updatedAt: new Date()
            }});
            console.log("[NextAuth SignIn] User update complete.");
          }
          console.log("[NextAuth SignIn] Sign-in successful. User object for JWT:", user);
          return true;
        } catch (error) {
          console.error("[NextAuth SignIn] Error during signIn callback:", error);
          console.log("[NextAuth SignIn] Denying access due to error. Returning false.");
          return false;
        }
      }
      console.log("[NextAuth SignIn] Account provider not Twitter or no profile. Check configuration. Returning false by default for this case.");
      return false;
    },
    async jwt({ token, user }: { token: JWT; user?: NextAuthUser /* User type here is from next-auth */ }) {
      console.log("[NextAuth JWT] Received token:", token, "User:", user);
      if (user?.xId) token.xId = user.xId;
      if (user?.dbId) token.dbId = user.dbId;
      if (user?.walletAddress) token.walletAddress = user.walletAddress;
      console.log("[NextAuth JWT] Returning token:", token);
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      console.log("[NextAuth Session] Received session:", session, "Token:", token);
      if (session.user) {
        if (token.xId) session.user.xId = token.xId as string;
        if (token.dbId) session.user.dbId = token.dbId as string;
        if (token.walletAddress) session.user.walletAddress = token.walletAddress as string;
      }
      console.log("[NextAuth Session] Returning session:", session);
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {},
}; 