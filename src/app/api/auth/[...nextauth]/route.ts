import NextAuth, { AuthOptions, User as NextAuthUser, Account, Profile } from "next-auth";
import { JWT } from "next-auth/jwt";
import TwitterProvider from "next-auth/providers/twitter";
import { connectToDatabase, UserDocument, ActionDocument } from "@/lib/mongodb";
import { randomBytes } from 'crypto';
import { Db } from 'mongodb';

const POINTS_INITIAL_CONNECTION = 100;

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

// Define a type for the Twitter profile for better type safety
interface TwitterProfile extends Profile {
    id_str?: string;
    screen_name?: string;
    profile_image_url_https?: string;
    // Add other fields from Twitter profile you might need
}

const authOptions: AuthOptions = {
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

          let dbUser = await usersCollection.findOne({ xUserId });
          console.log("[NextAuth SignIn] Found dbUser:", dbUser);

          if (!dbUser) {
            console.log("[NextAuth SignIn] User not found in DB, creating new user for xUserId:", xUserId);
            const newReferralCode = await generateUniqueReferralCode(db);
            const xUsername = twitterProfile.screen_name || user.name || undefined;
            const xProfileImageUrl = twitterProfile.profile_image_url_https || user.image || undefined;
            console.log("[NextAuth SignIn] New user details:", { newReferralCode, xUsername, xProfileImageUrl });

            const newUserDocData: Omit<UserDocument, '_id'> = {
              xUserId: xUserId,
              walletAddress: xUserId, // Using xUserId as walletAddress for new X users if no other wallet is linked yet
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
                walletAddress: xUserId, 
                actionType: 'initial_connection',
                pointsAwarded: POINTS_INITIAL_CONNECTION,
                timestamp: new Date(),
                notes: `New user via X login: ${xUserId}`
            });
            console.log("[NextAuth SignIn] Action inserted.");
            (user as NextAuthUser & { dbId?: string }).dbId = result.insertedId.toHexString();
          } else {
            console.log("[NextAuth SignIn] User found in DB, updating for xUserId:", xUserId);
            (user as NextAuthUser & { dbId?: string }).dbId = dbUser._id!.toHexString();
            const xUsername = twitterProfile.screen_name || user.name || undefined;
            const xProfileImageUrl = twitterProfile.profile_image_url_https || user.image || undefined;
            console.log("[NextAuth SignIn] Updating user with details:", { xUsername, xProfileImageUrl });
            await usersCollection.updateOne({ xUserId }, { $set: { 
              xUsername: xUsername,
              xProfileImageUrl: xProfileImageUrl, 
              updatedAt: new Date()
            }});
            console.log("[NextAuth SignIn] User update complete.");
          }
          (user as NextAuthUser & { xId?: string }).xId = xUserId;
          console.log("[NextAuth SignIn] Sign-in successful for xUserId:", xUserId, ". Returning true.");
          return true;
        } catch (error) {
          console.error("[NextAuth SignIn] Error during signIn callback:", error);
          console.log("[NextAuth SignIn] Denying access due to error. Returning false.");
          return false;
        }
      }
      console.log("[NextAuth SignIn] Account provider not Twitter or no profile. Check configuration. Returning false by default for this case.");
      // If the provider is not Twitter, or profile is missing, you might want to deny access
      // or handle it differently. For now, returning false if it's not the expected Twitter flow.
      return false;
    },
    async jwt({ token, user }: { token: JWT; user?: NextAuthUser; account?: Account | null; profile?: Profile }) {
      if (user && (user as NextAuthUser & { xId?: string }).xId) {
        token.xId = (user as NextAuthUser & { xId?: string }).xId;
      }
      if (user && (user as NextAuthUser & { dbId?: string }).dbId) {
        token.dbId = (user as NextAuthUser & { dbId?: string }).dbId;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      if (session.user && token.xId) {
        session.user.xId = token.xId as string;
      }
      if (session.user && token.dbId) {
        session.user.dbId = token.dbId as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {},
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 