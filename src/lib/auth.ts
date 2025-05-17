// @ts-nocheck

import { JWT } from "next-auth/jwt";
import TwitterProvider from "next-auth/providers/twitter";
import { connectToDatabase, UserDocument, ActionDocument } from "@/lib/mongodb"; // Assuming mongodb.ts is also in @/lib
import { randomBytes } from 'crypto';
import { Db } from 'mongodb';
import type { NextAuthOptions } from "next-auth";

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
  },
  callbacks: {
    async signIn({ user, account, profile }: any) {
      console.log(`[NextAuth SignIn] Callback triggered. Timestamp: ${new Date().toISOString()}`);
      console.log("[NextAuth SignIn] Received data:", JSON.stringify({ user, account, profile }, null, 2)); // Log incoming data

      if (account?.provider === "twitter" && profile) {
        const twitterProfile = profile as TwitterProfile;
        console.log("[NextAuth SignIn] Processing Twitter profile:", JSON.stringify(twitterProfile, null, 2)); // Log parsed Twitter profile

        try {
          const { db } = await connectToDatabase();
          console.log("[NextAuth SignIn] Connected to database.");
          const usersCollection = db.collection<UserDocument>('users');
          const actionsCollection = db.collection<ActionDocument>('actions');

          const xUserId = String(twitterProfile.id_str || user.id); // Ensure xUserId is a string
          console.log("[NextAuth SignIn] Extracted xUserId (ensured string):", xUserId);

          if (!xUserId || xUserId === "undefined") { // Enhanced check for invalid xUserId
            console.error(`[NextAuth SignIn] Critical: X User ID not found or invalid in profile. Denying access. Profile data:`, JSON.stringify(twitterProfile, null, 2));
            return false;
          }

          (user as any).xId = xUserId; // Attach xId to the user object for the session/JWT
          let determinedWalletAddress: string | undefined = undefined;

          let dbUser = await usersCollection.findOne({ xUserId });
          console.log(`[NextAuth SignIn] MongoDB findOne result for xUserId ${xUserId}:`, JSON.stringify(dbUser, null, 2));

          if (!dbUser) {
            console.log(`[NextAuth SignIn] User not found in DB, creating new user for xUserId: ${xUserId}`);
            const newReferralCode = await generateUniqueReferralCode(db);
            const xUsername = twitterProfile.screen_name || user.name || undefined;
            // Ensure profile_image_url_https is a full URL, otherwise undefined
            let rawProfileImageUrl = twitterProfile.profile_image_url_https || user.image || undefined;
            if (rawProfileImageUrl && !(rawProfileImageUrl.startsWith('http://') || rawProfileImageUrl.startsWith('https://'))) {
                console.warn(`[NextAuth SignIn] Received non-URL profile image: ${rawProfileImageUrl} for xUserId: ${xUserId}. Setting to undefined.`);
                rawProfileImageUrl = undefined;
            }
            const xProfileImageUrl = rawProfileImageUrl;

            console.log("[NextAuth SignIn] New user details to be saved:", JSON.stringify({ newReferralCode, xUsername, xProfileImageUrl, xUserId }, null, 2));

            determinedWalletAddress = undefined; // Wallet is not known at this stage for a new user
            const newUserDocData: Omit<UserDocument, '_id'> & { walletAddress?: string | undefined } = {
              xUserId: xUserId,
              walletAddress: determinedWalletAddress, // Explicitly undefined
              xUsername: xUsername,
              xProfileImageUrl: xProfileImageUrl,
              points: POINTS_INITIAL_CONNECTION,
              referralCode: newReferralCode,
              completedActions: ['initial_connection'],
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            console.log("[NextAuth SignIn] Inserting new user document:", JSON.stringify(newUserDocData, null, 2));
            const result = await usersCollection.insertOne(newUserDocData as UserDocument);
            console.log("[NextAuth SignIn] New user insert result:", JSON.stringify(result, null, 2));
            
            if (!result.insertedId) {
                console.error(`[NextAuth SignIn] Critical: Failed to insert new user for xUserId: ${xUserId}`);
                return false; // Deny sign-in if DB insert fails
            }

            console.log(`[NextAuth SignIn] Inserting initial_connection action for xUserId: ${xUserId}`);
            // For actions, if walletAddress is not yet known, use xUserId as a placeholder or decide policy
            const actionIdentifier = determinedWalletAddress || xUserId; 
            await actionsCollection.insertOne({
                walletAddress: actionIdentifier, // Use xUserId if walletAddress is unknown
                actionType: 'initial_connection',
                pointsAwarded: POINTS_INITIAL_CONNECTION,
                timestamp: new Date(),
                notes: `New user via X login: ${xUserId}`
            });
            console.log("[NextAuth SignIn] Action inserted.");
            (user as any).dbId = result.insertedId.toHexString(); // For JWT
            (user as any).walletAddress = determinedWalletAddress; // For JWT (will be undefined here)
          } else {
            console.log(`[NextAuth SignIn] User found in DB, updating for xUserId: ${xUserId}`);
            (user as any).dbId = dbUser._id!.toHexString(); // For JWT
            determinedWalletAddress = dbUser.walletAddress || undefined; // Preserve existing wallet or keep undefined
            (user as any).walletAddress = determinedWalletAddress; // For JWT

            const xUsername = twitterProfile.screen_name || user.name || undefined;
            // Ensure profile_image_url_https is a full URL, otherwise undefined
            let rawProfileImageUrl = twitterProfile.profile_image_url_https || user.image || undefined;
            if (rawProfileImageUrl && !(rawProfileImageUrl.startsWith('http://') || rawProfileImageUrl.startsWith('https://'))) {
                console.warn(`[NextAuth SignIn] Received non-URL profile image during update for xUserId: ${xUserId} - ${rawProfileImageUrl}. Using existing: ${dbUser.xProfileImageUrl}`);
                rawProfileImageUrl = dbUser.xProfileImageUrl; // Preserve existing if new one is invalid
            }
            const xProfileImageUrl = rawProfileImageUrl;
            
            console.log("[NextAuth SignIn] Details for update:", JSON.stringify({ xUsername, xProfileImageUrl, determinedWalletAddress }, null, 2));
            
            const updateData: Partial<UserDocument> = {
              xUsername: xUsername,
              xProfileImageUrl: xProfileImageUrl,
              updatedAt: new Date(),
              // Only set walletAddress if it's determined. Don't overwrite with undefined if already set.
              ...(determinedWalletAddress && { walletAddress: determinedWalletAddress }),
            };
            
            // If dbUser didn't have a wallet and now one is determined from elsewhere (not typical in this flow), update it.
            // However, walletAddress is usually set via a separate "connect wallet" flow.
            // Here we ensure we don't accidentally unset it.
            if (determinedWalletAddress && !dbUser.walletAddress) {
                updateData.walletAddress = determinedWalletAddress;
            } else if (!determinedWalletAddress && dbUser.walletAddress) {
                // If current determined is undefined, but dbUser has one, preserve it.
                // This case should not typically be hit if determinedWalletAddress is correctly sourced from dbUser.walletAddress.
                updateData.walletAddress = dbUser.walletAddress;
            }

            console.log(`[NextAuth SignIn] Updating user xUserId ${xUserId} with data:`, JSON.stringify(updateData, null, 2));
            await usersCollection.updateOne({ xUserId }, { $set: updateData });
            console.log("[NextAuth SignIn] User update complete.");
          }
          console.log(`[NextAuth SignIn] Sign-in successful for xUserId ${xUserId}. User object for JWT:`, JSON.stringify(user, null, 2));
          return true; // Successful sign-in
        } catch (error: any) { // Catch block for database/logic errors
          console.error(`[NextAuth SignIn] Error during signIn callback for xUserId ${(user as any)?.xId || 'UNKNOWN'}: `, error);
          console.error(`[NextAuth SignIn] Error name: ${error.name}, Message: ${error.message}, Stack: ${error.stack}`);
          console.log("[NextAuth SignIn] Denying access due to error. Returning false.");
          return false; // Deny sign-in on error
        }
      }
      // Fallback for non-Twitter providers or missing profile
      console.log("[NextAuth SignIn] Account provider not Twitter or no profile. Or other unhandled case. Check configuration. Returning false by default for this case.");
      return false;
    },
    async jwt({ token, user }: { token: JWT; user?: any }) {
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

        if (token.dbId && typeof token.dbId === 'string') {
          try {
            const { db } = await connectToDatabase();
            const usersCollection = db.collection<UserDocument>('users');
            const { ObjectId } = await import('mongodb'); // Dynamically import ObjectId

            if (ObjectId.isValid(token.dbId)) {
              const userFromDb = await usersCollection.findOne({ _id: new ObjectId(token.dbId) });
              if (userFromDb && userFromDb.role) {
                session.user.role = userFromDb.role;
              } else {
                session.user.role = 'user'; // Default role if not found or no role field in DB
              }
            } else {
              console.warn(`[NextAuth Session] dbId '${token.dbId}' is not a valid ObjectId. Cannot fetch role by _id.`);
              session.user.role = 'user'; // Default role
            }
          } catch (error) {
            console.error("[NextAuth Session] Error fetching user role:", error);
            session.user.role = 'user'; // Default role on error
          }
        } else {
          session.user.role = 'user'; // Default if no dbId in token or not a string
        }
      }
      console.log("[NextAuth Session] Returning session:", session);
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {},
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.callback-url' : 'next-auth.callback-url',
      options: {
        sameSite: 'none',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === 'production' ? '__Secure-next-auth.csrf-token' : 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'none',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  trustHost: true,
}; 