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
      if (account?.provider === "twitter" && profile) {
        const twitterProfile = profile as TwitterProfile;
        try {
          const { db } = await connectToDatabase();
          const usersCollection = db.collection<UserDocument>('users');
          const actionsCollection = db.collection<ActionDocument>('actions');

          const xUserId = twitterProfile.id_str || user.id;
          if (!xUserId) {
            console.error('X User ID not found in profile');
            return false;
          }

          let dbUser = await usersCollection.findOne({ xUserId });

          if (!dbUser) {
            const newReferralCode = await generateUniqueReferralCode(db);
            // Ensure optional fields are undefined if null or not present
            const xUsername = twitterProfile.screen_name || user.name || undefined;
            const xProfileImageUrl = twitterProfile.profile_image_url_https || user.image || undefined;

            const newUserDocData: Omit<UserDocument, '_id'> = {
              xUserId: xUserId,
              xUsername: xUsername,
              xProfileImageUrl: xProfileImageUrl,
              points: POINTS_INITIAL_CONNECTION,
              referralCode: newReferralCode,
              completedActions: ['initial_connection'],
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            const result = await usersCollection.insertOne(newUserDocData as UserDocument);
            
            await actionsCollection.insertOne({
                walletAddress: xUserId, 
                actionType: 'initial_connection',
                pointsAwarded: POINTS_INITIAL_CONNECTION,
                timestamp: new Date(),
                notes: `New user via X login: ${xUserId}`
            });
            (user as NextAuthUser & { dbId?: string }).dbId = result.insertedId.toHexString();
          } else {
            (user as NextAuthUser & { dbId?: string }).dbId = dbUser._id!.toHexString();
            // Ensure optional fields are undefined if null or not present for update
            const xUsername = twitterProfile.screen_name || user.name || undefined;
            const xProfileImageUrl = twitterProfile.profile_image_url_https || user.image || undefined;
            await usersCollection.updateOne({ xUserId }, { $set: { 
              xUsername: xUsername,
              xProfileImageUrl: xProfileImageUrl, 
              updatedAt: new Date()
            }});
          }
          (user as NextAuthUser & { xId?: string }).xId = xUserId;
          return true;
        } catch (error) {
          console.error("Error during signIn callback:", error);
          return false;
        }
      }
      return true;
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