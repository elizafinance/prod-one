// @ts-nocheck

import { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
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

// Diagnostics helper – writes denied sign-ins to a dedicated collection so we can trace the exact reason later.
async function logAuthFailure(reason: string, context: Record<string, any> = {}) {
  try {
    const { db } = await connectToDatabase();
    await db.collection('authFailures').insertOne({
      reason,
      context,
      timestamp: new Date(),
    });
  } catch (logErr) {
    // We never want logging to break auth – just emit to console if DB logging fails.
    console.error('[AuthFailureLogger] Failed to persist auth failure', logErr, { reason, context });
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'wallet',
      name: 'Wallet',
      credentials: {
        walletAddress: { label: 'Wallet Address', type: 'text' },
      },
      async authorize(credentials, req) {
        try {
          const walletAddressRaw = credentials?.walletAddress as string | undefined;
          if (!walletAddressRaw) {
            throw new Error('walletAddress is required');
          }
          const walletAddress = walletAddressRaw.trim();

          const { db } = await connectToDatabase();
          const usersCollection = db.collection<UserDocument>('users');

          const now = new Date();

          // Attempt to find existing user by walletAddress
          let userDoc = await usersCollection.findOne({ walletAddress });

          if (!userDoc) {
            // Create new user with INITIAL_LOGIN points and referralCode
            const referralCode = await generateUniqueReferralCode(db);
            const newUser = {
              walletAddress,
              xUserId: walletAddress, // Use wallet address as xUserId placeholder
              points: AIR.INITIAL_LOGIN,
              referralCode,
              completedActions: ['initial_connection'],
              createdAt: now,
              updatedAt: now,
              lastLoginAt: now,
              role: 'user',
              isActive: true,
            } as Omit<UserDocument, '_id'> as UserDocument;

            const insert = await usersCollection.insertOne(newUser);
            userDoc = { _id: insert.insertedId, ...newUser } as UserDocument;

            if (!userDoc.xUserId) {
              await usersCollection.updateOne({ _id: userDoc._id }, { $set: { xUserId: walletAddress } });
              userDoc.xUserId = walletAddress;
            }
          } else {
            // Update lastLoginAt and updatedAt
            await usersCollection.updateOne({ _id: userDoc._id }, { $set: { lastLoginAt: now, updatedAt: now } });
          }

          // Return user object expected by NextAuth
          return {
            id: userDoc._id.toHexString(),
            dbId: userDoc._id.toHexString(),
            walletAddress: userDoc.walletAddress,
            xId: userDoc.walletAddress, // For compatibility with existing logic expecting xId
            role: userDoc.role || 'user',
            name: userDoc.walletAddress,
          } as any;
        } catch (err) {
          console.error('[Credentials Authorize] Error:', err);
          return null;
        }
      },
    }),
    // TwitterProvider removed – wallet-only auth
  ],
  debug: true, // Enable debug logs
  session: {
    strategy: "jwt",
    maxAge: 72 * 60 * 60, // 72 hours in seconds
  },
  callbacks: {
    async signIn({ user, account }: any) {
      // Only allow the custom wallet/credentials provider
      if (account?.provider === 'wallet' || account?.provider === 'credentials') {
        return true;
      }
      // Deny all other providers (legacy Twitter removed)
      return false;
    },
    async jwt({ token, user }: { token: JWT; user?: any }) {
      console.log('[NextAuth JWT] Received token:', JSON.stringify(token, null, 2));
      console.log('[NextAuth JWT] Received user:', JSON.stringify(user, null, 2));
      
      // If user object is present (e.g., during sign-in or explicit update with user data),
      // prioritize its values to update the token.
      if (user) {
        if (user.xId) token.xId = user.xId;
        if (user.dbId) token.dbId = user.dbId;
        if (user.walletAddress) token.walletAddress = user.walletAddress;
        if (user.name) token.name = user.name;
        if (user.email) token.email = user.email; // Assuming email comes from twitter/user obj
        if (user.image) token.picture = user.image;
        if (user.role) token.role = user.role;
        // Potentially other fields from the initial user object
      }

      // If we have a dbId, always fetch the latest user data from the database
      // to ensure the token reflects the most current state (e.g., after linking a wallet).
      if (token.dbId && typeof token.dbId === 'string') {
        try {
          const { db } = await connectToDatabase();
          const usersCollection = db.collection<UserDocument>('users');
          const { ObjectId } = await import('mongodb');
          
          if (ObjectId.isValid(token.dbId)) {
            const userFromDb = await usersCollection.findOne({ _id: new ObjectId(token.dbId) });
            if (userFromDb) {
              console.log('[NextAuth JWT] Fetched userFromDb:', JSON.stringify(userFromDb, null, 2));
              // Update token with fresh data from DB
              token.name = userFromDb.xUsername || token.name; // Prefer xUsername if available
              // token.email = userFromDb.email || token.email; // If you store email in DB and want to refresh
              token.picture = userFromDb.xProfileImageUrl || token.picture;
              token.role = userFromDb.role || 'user';
              token.walletAddress = userFromDb.walletAddress || null; // Ensure walletAddress is updated
              // Update any other fields you want to keep synchronized in the token
              console.log('[NextAuth JWT] Updated token with DB data (incl. walletAddress):', token.walletAddress, 'Role:', token.role);
            } else {
              console.warn('[NextAuth JWT] User not found in DB for dbId:', token.dbId);
              // Potentially invalidate token or handle as an error if user should exist
            }
          } else {
            console.warn('[NextAuth JWT] Invalid ObjectId for dbId:', token.dbId);
          }
        } catch (error) {
          console.error("[NextAuth JWT] Error fetching user data from DB:", error);
          // Decide if/how to handle this, e.g., proceed with possibly stale token data
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