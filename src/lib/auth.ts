// @ts-nocheck

import { JWT } from "next-auth/jwt";
import TwitterProvider from "next-auth/providers/twitter";
import { connectToDatabase, UserDocument, ActionDocument } from "@/lib/mongodb"; // Assuming mongodb.ts is also in @/lib
import { randomBytes } from 'crypto';
import { Db, ObjectId } from 'mongodb';
import type { NextAuthOptions } from "next-auth"; // This import might vary based on NextAuth version
import { AIR } from '@/config/points.config'; // Import AIR constants

// const POINTS_INITIAL_CONNECTION = 100; // Replaced by AIR.INITIAL_LOGIN

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

interface TwitterProfile {
  id_str?: string;
  screen_name?: string;
  profile_image_url_https?: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    TwitterProvider({
      clientId: process.env.X_CLIENT_ID!,
      clientSecret: process.env.X_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 72 * 60 * 60, // 72 hours in seconds
  },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      console.log(`[NextAuth SignIn] Callback triggered. Provider: ${account?.provider}. Timestamp: ${new Date().toISOString()}`);

      // --- Twitter login (existing flow) ---
      if (account?.provider === "twitter" && profile) {
        const twitterProfile = profile as TwitterProfile;

        try {
          const { db } = await connectToDatabase();
          const usersCollection = db.collection<UserDocument>('users');
          const actionsCollection = db.collection<ActionDocument>('actions');

          const xUserId = String(twitterProfile.id_str || user.id);

          if (!xUserId || xUserId === "undefined") { 
            console.error(`[NextAuth SignIn] Critical: X User ID not found or invalid in profile. Denying access. Profile data:`, JSON.stringify(twitterProfile, null, 2));
            return false;
          }

          // Attach custom fields to the user object that NextAuth will pass to the JWT callback
          (user as any).xId = xUserId;
          let determinedWalletAddress: string | undefined = undefined;

          let dbUser = await usersCollection.findOne({ xUserId });

          if (!dbUser) {
            const newReferralCode = await generateUniqueReferralCode(db);
            const xUsername = twitterProfile.screen_name || user.name || undefined;
            let rawProfileImageUrl = twitterProfile.profile_image_url_https || user.image || undefined;
            if (rawProfileImageUrl && !(rawProfileImageUrl.startsWith('http://') || rawProfileImageUrl.startsWith('https://'))) {
                rawProfileImageUrl = undefined;
            }
            const xProfileImageUrl = rawProfileImageUrl;

            determinedWalletAddress = undefined; 
            const newUserDocData: Omit<UserDocument, '_id'> & { walletAddress?: string | undefined } = {
              xUserId: xUserId,
              walletAddress: determinedWalletAddress,
              xUsername: xUsername,
              xProfileImageUrl: xProfileImageUrl,
              points: AIR.INITIAL_LOGIN, // Use AIR constant
              referralCode: newReferralCode,
              completedActions: ['initial_connection'],
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            const result = await usersCollection.insertOne(newUserDocData as UserDocument);
            if (!result.insertedId) {
                console.error(`[NextAuth SignIn] Critical: Failed to insert new user for xUserId: ${xUserId}`);
                return false; 
            }

            const actionIdentifier = determinedWalletAddress || xUserId; 
            await actionsCollection.insertOne({
                walletAddress: actionIdentifier, 
                actionType: 'initial_connection',
                pointsAwarded: AIR.INITIAL_LOGIN, // Use AIR constant
                timestamp: new Date(),
                notes: `New user via X login: ${xUserId}`
            });
            (user as any).dbId = result.insertedId.toHexString();
            (user as any).walletAddress = determinedWalletAddress; 
          } else {
            (user as any).dbId = dbUser._id!.toHexString();
            determinedWalletAddress = dbUser.walletAddress || undefined;
            (user as any).walletAddress = determinedWalletAddress;

            const xUsername = twitterProfile.screen_name || user.name || undefined;
            let rawProfileImageUrl = twitterProfile.profile_image_url_https || user.image || undefined;
            if (rawProfileImageUrl && !(rawProfileImageUrl.startsWith('http://') || rawProfileImageUrl.startsWith('https://'))) {
                rawProfileImageUrl = dbUser.xProfileImageUrl; 
            }
            const xProfileImageUrl = rawProfileImageUrl;
            
            const updateData: Partial<UserDocument> = {
              xUsername: xUsername,
              xProfileImageUrl: xProfileImageUrl,
              updatedAt: new Date(),
            };
            if (determinedWalletAddress && !dbUser.walletAddress) {
                updateData.walletAddress = determinedWalletAddress;
            } else if (!determinedWalletAddress && dbUser.walletAddress) {
                updateData.walletAddress = dbUser.walletAddress;
            }
            await usersCollection.updateOne({ xUserId }, { $set: updateData });
          }
          return true; 
        } catch (error: any) { 
          console.error(`[NextAuth SignIn] Error during signIn callback for xUserId ${(user as any)?.xId || 'UNKNOWN'}: `, error);
          return false; 
        }
      }

      // Only Twitter accounts allowed – deny any others
      console.log(`[NextAuth SignIn] Account provider ${account?.provider} not allowed.`);
      return false;
    },
    async jwt({ token, user }: { token: JWT; user?: any }) {
      console.log('[NextAuth JWT] Received token:', JSON.stringify(token, null, 2));
      console.log('[NextAuth JWT] Received user:', JSON.stringify(user, null, 2));
      
      if (user?.xId) token.xId = user.xId;
      if (user?.dbId) token.dbId = user.dbId;
      if (user?.walletAddress) token.walletAddress = user.walletAddress;
      if (user?.name) token.name = user.name;
      if (user?.email) token.email = user.email;
      if (user?.image) token.picture = user.image;
      if (user?.role) token.role = user.role;

      // If we have a dbId, fetch the latest role from the database
      if (token.dbId) {
        try {
          const { db } = await connectToDatabase();
          const usersCollection = db.collection<UserDocument>('users');
          const { ObjectId } = await import('mongodb');
          if (ObjectId.isValid(token.dbId)) {
            const userFromDb = await usersCollection.findOne({ _id: new ObjectId(token.dbId) });
            if (userFromDb) {
              token.role = userFromDb.role || 'user';
              console.log('[NextAuth JWT] Updated role from DB:', token.role);
            }
          }
        } catch (error) {
          console.error("[NextAuth JWT] Error fetching user role:", error);
        }
      }

      console.log('[NextAuth JWT] Final token:', JSON.stringify(token, null, 2));
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      if (session.user) {
        session.user.xId = token.xId as string || null;
        session.user.dbId = token.dbId as string || null;
        session.user.walletAddress = token.walletAddress as string || null;
        session.user.name = token.name as string || null;
        session.user.email = token.email as string || null;
        session.user.image = token.picture as string || null;
        session.user.role = token.role as string || 'user';

        if (token.dbId && typeof token.dbId === 'string') {
          try {
            const { db } = await connectToDatabase();
            const usersCollection = db.collection<UserDocument>('users');
            const { ObjectId } = await import('mongodb');
            if (ObjectId.isValid(token.dbId)) {
              const userFromDb = await usersCollection.findOne({ _id: new ObjectId(token.dbId) });
              if (userFromDb) {
                session.user.role = userFromDb.role || 'user';
                token.role = userFromDb.role || 'user';
              }
            }
          } catch (error) {
            console.error("[NextAuth Session] Error fetching user role:", error);
            session.user.role = 'user';
            token.role = 'user';
          }
        } else {
          session.user.role = 'user';
          token.role = 'user';
        }
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {},
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: { httpOnly: true, sameSite: 'none', path: '/', secure: process.env.NODE_ENV === 'production' },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.callback-url' : 'next-auth.callback-url',
      options: { sameSite: 'none', path: '/', secure: process.env.NODE_ENV === 'production' },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.csrf-token' : 'next-auth.csrf-token',
      options: { httpOnly: true, sameSite: 'none', path: '/', secure: process.env.NODE_ENV === 'production' },
    },
  },
  trustHost: true,
}; 