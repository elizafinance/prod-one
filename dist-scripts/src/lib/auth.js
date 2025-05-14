import TwitterProvider from "next-auth/providers/twitter";
import { connectToDatabase } from "@/lib/mongodb"; // Assuming mongodb.ts is also in @/lib
import { randomBytes } from 'crypto';
const POINTS_INITIAL_CONNECTION = 100; // Make sure this constant is accessible or redefined if needed locally
// This function is used by authOptions, so it needs to be here or imported.
async function generateUniqueReferralCode(db, length = 8) {
    const usersCollection = db.collection('users');
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
export const authOptions = {
    providers: [
        TwitterProvider({
            clientId: process.env.X_CLIENT_ID,
            clientSecret: process.env.X_CLIENT_SECRET,
        }),
    ],
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async signIn({ user, account, profile }) {
            console.log("[NextAuth SignIn] Received data:", { user, account, profile });
            if (account?.provider === "twitter" && profile) {
                const twitterProfile = profile;
                console.log("[NextAuth SignIn] Processing Twitter profile:", twitterProfile);
                try {
                    const { db } = await connectToDatabase();
                    console.log("[NextAuth SignIn] Connected to database.");
                    const usersCollection = db.collection('users');
                    const actionsCollection = db.collection('actions');
                    const xUserId = String(twitterProfile.id_str || user.id);
                    console.log("[NextAuth SignIn] Extracted xUserId (ensured string):", xUserId);
                    if (!xUserId) {
                        console.error('[NextAuth SignIn] X User ID not found in profile. Denying access.');
                        return false;
                    }
                    user.xId = xUserId;
                    let determinedWalletAddress = undefined;
                    let dbUser = await usersCollection.findOne({ xUserId });
                    console.log("[NextAuth SignIn] Found dbUser:", dbUser);
                    if (!dbUser) {
                        console.log("[NextAuth SignIn] User not found in DB, creating new user for xUserId:", xUserId);
                        const newReferralCode = await generateUniqueReferralCode(db);
                        const xUsername = twitterProfile.screen_name || user.name || undefined;
                        const xProfileImageUrl = twitterProfile.profile_image_url_https || user.image || undefined;
                        console.log("[NextAuth SignIn] New user details:", { newReferralCode, xUsername, xProfileImageUrl });
                        determinedWalletAddress = xUserId;
                        const newUserDocData = {
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
                        const result = await usersCollection.insertOne(newUserDocData);
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
                        user.dbId = result.insertedId.toHexString();
                        user.walletAddress = determinedWalletAddress;
                    }
                    else {
                        console.log("[NextAuth SignIn] User found in DB, updating for xUserId:", xUserId);
                        user.dbId = dbUser._id.toHexString();
                        determinedWalletAddress = dbUser.walletAddress || dbUser.xUserId;
                        user.walletAddress = determinedWalletAddress;
                        const xUsername = twitterProfile.screen_name || user.name || undefined;
                        const xProfileImageUrl = twitterProfile.profile_image_url_https || user.image || undefined;
                        console.log("[NextAuth SignIn] Updating user with details:", { xUsername, xProfileImageUrl });
                        await usersCollection.updateOne({ xUserId }, { $set: {
                                xUsername: xUsername,
                                xProfileImageUrl: xProfileImageUrl,
                                walletAddress: determinedWalletAddress,
                                updatedAt: new Date()
                            } });
                        console.log("[NextAuth SignIn] User update complete.");
                    }
                    console.log("[NextAuth SignIn] Sign-in successful. User object for JWT:", user);
                    return true;
                }
                catch (error) {
                    console.error("[NextAuth SignIn] Error during signIn callback:", error);
                    console.log("[NextAuth SignIn] Denying access due to error. Returning false.");
                    return false;
                }
            }
            console.log("[NextAuth SignIn] Account provider not Twitter or no profile. Check configuration. Returning false by default for this case.");
            return false;
        },
        async jwt({ token, user }) {
            console.log("[NextAuth JWT] Received token:", token, "User:", user);
            if (user?.xId)
                token.xId = user.xId;
            if (user?.dbId)
                token.dbId = user.dbId;
            if (user?.walletAddress)
                token.walletAddress = user.walletAddress;
            console.log("[NextAuth JWT] Returning token:", token);
            return token;
        },
        async session({ session, token }) {
            console.log("[NextAuth Session] Received session:", session, "Token:", token);
            if (session.user) {
                if (token.xId)
                    session.user.xId = token.xId;
                if (token.dbId)
                    session.user.dbId = token.dbId;
                if (token.walletAddress)
                    session.user.walletAddress = token.walletAddress;
            }
            console.log("[NextAuth Session] Returning session:", session);
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
    pages: {},
};
