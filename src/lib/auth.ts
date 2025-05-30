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
        chain: { label: 'Chain', type: 'text' },
      },
      async authorize(credentials, req) {
        // console.log("[NextAuth DEBUG - authorize] Received credentials:", JSON.stringify(credentials, null, 2)); // Log received credentials
        try {
          const walletAddressRaw = credentials?.walletAddress as string | undefined;
          const chain = credentials?.chain as string | undefined;

          if (!walletAddressRaw) {
            throw new Error('walletAddress is required');
          }
          const walletAddress = walletAddressRaw.trim();

          let db: Db | null = null;
          let usersCollection: any = null;
          try {
            if (process.env.MONGODB_URI && process.env.MONGODB_DB_NAME) {
              const conn = await connectToDatabase();
              db = conn.db;
              usersCollection = db.collection<UserDocument>('users');
            }
          } catch (err) {
            console.warn('[Credentials Authorize] Could not connect to MongoDB. Falling back to dev user.', err);
          }

          // If we still don't have a collection (DB unavailable in dev), shortcut with an in-memory user
          if (!usersCollection) {
            // Dev fallback: return ephemeral user so sign-in succeeds without DB
            return {
              id: walletAddress,
              dbId: walletAddress,
              walletAddress,
              xId: walletAddress,
              role: 'user',
              name: walletAddress,
              chain: chain || 'unknown',
            } as any;
          }

          const now = new Date();

          // Attempt to find existing user by walletAddress
          let userDoc = await usersCollection.findOne({ walletAddress });

          if (!userDoc) {
            // Create new user with INITIAL_LOGIN points and referralCode
            const referralCode = await generateUniqueReferralCode(db);
            const newUser = {
              walletAddress,
              walletChain: chain || 'unknown',
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
            // Update lastLoginAt, updatedAt, and potentially walletChain if provided and different
            const updates: any = { lastLoginAt: now, updatedAt: now };
            if (chain && userDoc.walletChain !== chain) {
              updates.walletChain = chain;
            }
            await usersCollection.updateOne({ _id: userDoc._id }, { $set: updates });
            if (updates.walletChain) userDoc.walletChain = updates.walletChain; // Reflect update in userDoc
          }

          // Return user object expected by NextAuth
          const authUserObject = {
            id: userDoc._id.toHexString(),
            dbId: userDoc._id.toHexString(),
            walletAddress: userDoc.walletAddress,
            xId: userDoc.xUserId || userDoc.walletAddress,
            role: userDoc.role || 'user',
            name: userDoc.xUsername || userDoc.walletAddress,
            chain: userDoc.walletChain || chain || 'unknown',
          };
          // console.log("[NextAuth DEBUG - authorize] Returning user object:", JSON.stringify(authUserObject, null, 2));
          return authUserObject as any;
        } catch (err) {
          console.error('[NextAuth DEBUG - authorize] Error:', err);
          return null;
        }
      },
    }),
    // TwitterProvider removed – wallet-only auth
  ],
  debug: process.env.NODE_ENV === 'development', // Enable debug logs only in development
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
      await logAuthFailure('Denied sign-in: Invalid provider.', { provider: account?.provider });
      return false;
    },
    async jwt({ token, user, account, profile, isNewUser }: { token: JWT; user?: any; account?: any; profile?: any; isNewUser?: boolean }) {
      // console.log("[NextAuth DEBUG - jwt callback] Initial token:", JSON.stringify(token, null, 2));
      // console.log("[NextAuth DEBUG - jwt callback] User object (from authorize or session update):", JSON.stringify(user, null, 2));
      // console.log("[NextAuth DEBUG - jwt callback] Account object (from provider):", JSON.stringify(account, null, 2));
      // console.log("[NextAuth DEBUG - jwt callback] Profile object (from provider):", JSON.stringify(profile, null, 2));
      // console.log("[NextAuth DEBUG - jwt callback] isNewUser:", isNewUser);
      
      if (user) { // This block runs on sign-in or when session is updated with user object
        token.dbId = user.dbId || user.id; 
        token.walletAddress = user.walletAddress;
        token.role = user.role;
        token.chain = user.chain; // Persist chain from user object (returned by authorize) into JWT
        // console.log("[NextAuth DEBUG - jwt callback] Token updated from user object. New chain:", token.chain);
      }

      // Fetch from DB to ensure critical data is fresh, but be mindful of performance.
      // This might be redundant if authorize always returns the most up-to-date data required for the token.
      if (token.dbId && typeof token.dbId === 'string' && process.env.MONGODB_URI && process.env.MONGODB_DB_NAME) {
        try {
          const { db } = await connectToDatabase();
          const usersCollection = db.collection<UserDocument>('users');
          const { ObjectId } = await import('mongodb'); 
          
          if (ObjectId.isValid(token.dbId)) {
            const userFromDb = await usersCollection.findOne({ _id: new ObjectId(token.dbId) });
            if (userFromDb) {
              token.walletAddress = userFromDb.walletAddress || token.walletAddress; 
              token.role = userFromDb.role || 'user'; 
              token.chain = userFromDb.walletChain || token.chain || 'unknown'; // Update chain from DB's walletChain
              // console.log("[NextAuth DEBUG - jwt callback] Token updated from DB. New chain:", token.chain);
            } else {
              console.warn('[NextAuth JWT] User not found in DB for dbId:', token.dbId);
              // If user not found, might indicate an issue. Could clear parts of token or invalidate.
              // For now, we'll let it proceed with existing token data but log a warning.
            }
          } else {
            console.warn('[NextAuth JWT] Invalid ObjectId for dbId:', token.dbId);
          }
        } catch (error) {
          console.error("[NextAuth JWT] Error fetching user data from DB:", error);
        }
      }

      // console.log('[NextAuth JWT] Final token:', JSON.stringify(token, null, 2));
      return token;
    },
    async session({ session, token }: { session: any; token: JWT }) {
      // console.log("[NextAuth DEBUG - session callback] Token received:", JSON.stringify(token, null, 2));
      session.user.id = token.sub || token.dbId; 
      session.user.dbId = token.dbId as string || null;
      session.user.walletAddress = token.walletAddress as string || null;
      session.user.role = token.role as string || 'user'; 
      session.user.chain = token.chain as string || 'unknown'; 
      // console.log("[NextAuth DEBUG - session callback] Session object to be returned:", JSON.stringify(session, null, 2));
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET, // Explicitly use the secret from env
  pages: {
    // signIn: '/auth/signin', // Example: define custom sign-in page
    // error: '/auth/error', // Example: define custom error page for auth errors
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: { 
        httpOnly: true, 
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for production if cross-site, 'lax' otherwise and for dev
        path: '/', 
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.COOKIE_DOMAIN || undefined, // Use COOKIE_DOMAIN from env
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.callback-url' : 'next-auth.callback-url',
      options: { 
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', 
        path: '/', 
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.COOKIE_DOMAIN || undefined,
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production' ? (process.env.NEXTAUTH_URL?.startsWith("https://") ? '__Host-next-auth.csrf-token' : '__Secure-next-auth.csrf-token') : 'next-auth.csrf-token',
      options: { 
        httpOnly: true, 
        sameSite: 'lax', // CSRF token is usually 'lax'
        path: '/', 
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.COOKIE_DOMAIN || undefined, // CSRF tokens are typically not domain-wide but scoped to the host
      },
    },
    // Consider PKCE cookie config if using OAuth providers that support PKCE
    // pkceCodeVerifier: {
    //   name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.pkce.code_verifier' : 'next-auth.pkce.code_verifier',
    //   options: {
    //     httpOnly: true,
    //     sameSite: 'lax',
    //     path: '/',
    //     secure: process.env.NODE_ENV === 'production',
    //     maxAge: 60 * 15, // 15 minutes
    //     domain: process.env.COOKIE_DOMAIN || undefined,
    //   }
    // }
  },
  trustHost: true, // Useful if your app is behind a proxy
}; 