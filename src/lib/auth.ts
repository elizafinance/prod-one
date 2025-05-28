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
    TwitterProvider({
      clientId: process.env.X_CLIENT_ID!,
      clientSecret: process.env.X_CLIENT_SECRET!,
      version: "2.0", // Add explicit version
    }),
  ],
  debug: true, // Enable debug logs
  session: {
    strategy: "jwt",
    maxAge: 72 * 60 * 60, // 72 hours in seconds
  },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      // Debug logging
      console.log('==== NextAuth SignIn Debug ====');
      console.log('Environment:', {
        X_CLIENT_ID_SET: !!process.env.X_CLIENT_ID,
        X_CLIENT_SECRET_SET: !!process.env.X_CLIENT_SECRET,
        NEXTAUTH_SECRET_SET: !!process.env.NEXTAUTH_SECRET,
        NODE_ENV: process.env.NODE_ENV
      });
      console.log('Account:', JSON.stringify(account, null, 2));
      console.log('Profile:', JSON.stringify(profile, null, 2));
      console.log('User:', JSON.stringify(user, null, 2));
      console.log('============================');

      if (!account) {
        console.error('[NextAuth SignIn] No account object provided');
        await logAuthFailure('no_account_object', { user, profile });
        return false;
      }

      // --- Twitter login (existing flow) ---
      if (account?.provider === "twitter" && profile) {
        const twitterProfile = profile as TwitterProfile;

        try {
          const { db } = await connectToDatabase();
          const usersCollection = db.collection<UserDocument>('users');
          const actionsCollection = db.collection<ActionDocument>('actions');

          const xUserId = String(
            twitterProfile.id_str ??         // Original
            (profile as any).id ??           // OAuth 2.0 spec (often numeric)
            account?.providerAccountId ?? // Always present from provider
            user.id                          // NextAuth user.id (fallback)
          );

          if (!xUserId || xUserId === "undefined") { 
            console.error(`[NextAuth SignIn] Critical: X User ID not found or invalid in profile. Denying access. Profile data:`, JSON.stringify(profile, null, 2), JSON.stringify(user, null, 2), JSON.stringify(account, null, 2));
            await logAuthFailure('missing_xUserId', { profile, account, user });
            return false;
          }

          // Attach custom fields to the user object that NextAuth will pass to the JWT callback
          (user as any).xId = xUserId;
          // let determinedWalletAddress: string | undefined = undefined; // Not used here, can be removed

          const now = new Date(); // For consistent timestamps

          // Convert findOne + insertOne to a single findOneAndUpdate with upsert
          const xUsername = twitterProfile.screen_name || user.name || undefined;
          // const xDisplayName = profile.name || user.name; // Consider if you want to store this separately
          let rawProfileImageUrl = twitterProfile.profile_image_url_https || user.image || undefined;
          if (rawProfileImageUrl && !(rawProfileImageUrl.startsWith('http://') || rawProfileImageUrl.startsWith('https://'))) {
              rawProfileImageUrl = undefined; 
          }
          const xProfileImageUrl = rawProfileImageUrl;

          const updateOnInsert = {
            xUserId: xUserId,
            xUsername: xUsername, // Also set xUsername on insert
            xProfileImageUrl: xProfileImageUrl, // Also set xProfileImageUrl on insert
            walletAddress: undefined, 
            points: AIR.INITIAL_LOGIN,
            referralCode: await generateUniqueReferralCode(db), 
            completedActions: [{ action: 'initial_connection', timestamp: now }], // Store as object array
            createdAt: now,
            updatedAt: now, // Match createdAt on insert
            lastLoginAt: now, // Set lastLoginAt on insert
            role: 'user', 
            isActive: true // Set isActive on insert
          };

          // --- Attempt the upsert with basic retry on duplicate key errors (e.g. referralCode collision) ---
          let dbUserResult: any = null;
          const MAX_UPSERT_ATTEMPTS = 5;
          for (let attempt = 1; attempt <= MAX_UPSERT_ATTEMPTS; attempt++) {
            try {
              dbUserResult = await usersCollection.findOneAndUpdate(
                { xUserId: xUserId },
                {
                  $setOnInsert: attempt === 1 ? updateOnInsert : {
                    ...updateOnInsert,
                    referralCode: await generateUniqueReferralCode(db) 
                  },
                  $set: {
                    xUsername: xUsername, // Ensure xUsername is updated on subsequent logins
                    xProfileImageUrl: xProfileImageUrl, // Ensure xProfileImageUrl is updated
                    // xDisplayName: xDisplayName, // If you store display name
                    lastLoginAt: now, // Update lastLoginAt on every successful sign-in
                    updatedAt: now, // Update updatedAt on every successful sign-in
                  },
                },
                {
                  upsert: true,
                  returnDocument: 'after', // Returns the new or updated document
                }
              );
              // Success – break the retry loop
              if (dbUserResult?.value) break;
            } catch (upsertErr: any) {
              if (upsertErr?.code === 11000 && attempt < MAX_UPSERT_ATTEMPTS) {
                console.warn(`[NextAuth SignIn] Duplicate key on upsert attempt ${attempt}. Retrying with new referral code...`);
                continue; // Retry the loop
              }
              // For any other error (or final failed attempt) re-throw to outer catch
              throw upsertErr;
            }
          }

          if (!dbUserResult || !dbUserResult.value) {
            // As a fallback, attempt to fetch the user (might have been inserted but not returned)
            const fallbackUser = await usersCollection.findOne({ xUserId });
            if (fallbackUser) {
              dbUserResult = { value: fallbackUser } as any;
            } else {
              console.error(`[NextAuth SignIn] Critical: Failed to upsert user for xUserId: ${xUserId} after ${MAX_UPSERT_ATTEMPTS} attempts.`);
              return false;
            }
          }
          
          const dbUser = dbUserResult.value;

          // If the user was just inserted, record the initial_connection action
          // const wasInserted = dbUser.createdAt.getTime() === dbUser.updatedAt.getTime() && dbUser.points === AIR.INITIAL_LOGIN;
          // A more reliable check for insertion, especially if updatedAt can be modified by other processes soon after creation,
          // is to check if the specific fields set only by $setOnInsert are present and match.
          // For example, if points are only set on insert and not typically reset to INITIAL_LOGIN.
          // Or, if the version of MongoDB driver supports it, dbUserResult.lastErrorObject?.upserted is the best.
          // Given our current structure, comparing createdAt and lastLoginAt (both set to `now` on insert)
          // and also checking if completedActions has only one entry (the initial_connection)
          // should be a reasonably good heuristic for a new user insert for logging to actionsCollection.
          
          const wasLikelyInserted = dbUser.createdAt.getTime() === now.getTime() && 
                                 dbUser.lastLoginAt.getTime() === now.getTime() &&
                                 Array.isArray(dbUser.completedActions) && 
                                 dbUser.completedActions.length === 1 && 
                                 dbUser.completedActions[0]?.action === 'initial_connection';

          if (wasLikelyInserted) {
            // Record action for new user
            await actionsCollection.insertOne({
                // Use xUserId as identifier here, as wallet might not be linked yet.
                // Or, if actions are always tied to a user record, user._id (dbUser._id) is better.
                // For consistency, let's use dbUser._id if available.
                userId: dbUser._id, 
                identifierType: 'dbId',
                identifierValue: dbUser._id.toHexString(),
                actionType: 'initial_connection',
                pointsAwarded: AIR.INITIAL_LOGIN,
                timestamp: now, // Use the consistent `now` timestamp
                notes: `New user via X login: ${xUserId} (${xUsername || 'N/A'})`
            });
          }
          
          (user as any).dbId = dbUser._id!.toHexString();
          (user as any).walletAddress = dbUser.walletAddress || undefined; 
          (user as any).role = dbUser.role || 'user';
          // Pass other relevant fields from dbUser to the user object for JWT/session if needed
          (user as any).isActive = dbUser.isActive;
          (user as any).points = dbUser.points;
          (user as any).referralCode = dbUser.referralCode;
          // (user as any).completedActions = dbUser.completedActions; // Potentially large, maybe not for JWT

          return true; 
        } catch (error: any) { 
          console.error(`[NextAuth SignIn] Error during signIn callback for xUserId ${(user as any)?.xId || 'UNKNOWN'}: `, error);
          if (error.code === 11000) {
            console.error("[NextAuth SignIn] Duplicate key error during user upsert after retries. Attempting to recover by loading existing user.");
            try {
              const { db } = await connectToDatabase();
              const usersCollection = db.collection<UserDocument>('users');
              const existing = await usersCollection.findOne({ xUserId: (user as any)?.xId });
              if (existing) {
                (user as any).dbId = existing._id!.toHexString();
                (user as any).walletAddress = existing.walletAddress || undefined;
                (user as any).role = existing.role || 'user';
                console.log('[NextAuth SignIn] Recovery successful – proceeding with sign-in for existing user');
                return true;
              }
            } catch (recoveryErr) {
              console.error('[NextAuth SignIn] Recovery attempt failed', recoveryErr);
            }
          }
          // Log the failure details so we can inspect later
          await logAuthFailure('signIn_callback_error', {
            error: error?.message || String(error),
            code: error?.code,
            provider: account?.provider,
            xId: (user as any)?.xId,
          });
          return false; 
        }
      }

      // Only Twitter accounts allowed – deny any others
      console.log(`[NextAuth SignIn] Account provider ${account?.provider} not allowed.`);
      await logAuthFailure('provider_not_allowed', { provider: account?.provider, user, profile });
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