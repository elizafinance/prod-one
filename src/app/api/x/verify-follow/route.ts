import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { decrypt, encrypt } from '@/lib/encryption'; // Import encrypt for refreshing token
import { ObjectId } from 'mongodb';

const DEFAI_REWARDS_X_USER_ID = process.env.DEFAI_REWARDS_X_USER_ID;
const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;

// Helper function to refresh X access token
async function refreshXAccessToken(refreshToken: string, userId: ObjectId): Promise<string | null> {
    if (!X_CLIENT_ID || !X_CLIENT_SECRET) {
        console.error('[RefreshXToken] Client ID or Secret for X not configured.');
        return null;
    }
    try {
        const response = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')}`,
            },
            body: new URLSearchParams({
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
                client_id: X_CLIENT_ID, // X might require client_id even for refresh with basic auth
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`[RefreshXToken] Failed to refresh X token for user ${userId}:`, errorData);
            // If refresh fails (e.g., token revoked), clear the stored tokens
            if (response.status === 400 || response.status === 401) {
                const { db } = await connectToDatabase();
                await db.collection<UserDocument>('users').updateOne(
                    { _id: userId }, 
                    { $unset: { linkedXAccessToken: "", linkedXRefreshToken: "", linkedXScopes: "", linkedXConnectedAt: "" } }
                );
                console.log(`[RefreshXToken] Cleared X tokens for user ${userId} due to refresh failure.`);
            }
            return null;
        }

        const newTokens = await response.json();
        const newAccessToken = newTokens.access_token;
        const newRefreshToken = newTokens.refresh_token; // X might issue a new refresh token

        // Update the database with the new tokens (encrypted)
        const { db } = await connectToDatabase();
        await db.collection<UserDocument>('users').updateOne(
            { _id: userId }, 
            {
                $set: {
                    linkedXAccessToken: encrypt(newAccessToken),
                    ...(newRefreshToken && { linkedXRefreshToken: encrypt(newRefreshToken) }), // Only update if new one is provided
                    updatedAt: new Date(),
                }
            }
        );
        console.log(`[RefreshXToken] Successfully refreshed X token for user ${userId}`);
        return newAccessToken;
    } catch (error) {
        console.error(`[RefreshXToken] Error during token refresh for user ${userId}:`, error);
        return null;
    }
}

export async function POST(req: NextRequest) {
    if (!DEFAI_REWARDS_X_USER_ID) {
        console.error('[Verify Follow] DEFAI_REWARDS_X_USER_ID not configured.');
        return NextResponse.json({ error: 'Target X account not configured on server.' }, { status: 500 });
    }

    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.dbId) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const userId = new ObjectId(session.user.dbId);
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const user = await usersCollection.findOne({ _id: userId });

    if (!user || !user.linkedXId || !user.linkedXAccessToken) {
        return NextResponse.json({ error: 'X account not linked or access token missing.', isLinked: false, follows: false }, { status: 400 });
    }

    let accessToken = decrypt(user.linkedXAccessToken);
    let followsTarget = false;
    let attempt = 0;
    const maxAttempts = 2; // Initial attempt + 1 retry after refresh

    while (attempt < maxAttempts) {
        try {
            // Using GET /2/users/:source_user_id/following to check if target is in the list
            // This endpoint is paginated. We might need to handle pagination if users follow many accounts.
            // For a direct check, X API v1.1 had friendships/show. X API v2 is a bit different.
            // A simpler check (if user is following few people) might be enough or look for a direct relationship endpoint for User Context OAuth 2.0.
            // For now, we will assume checking the first page of following is indicative for this use case, or that a more direct endpoint exists.
            // The ideal endpoint would be: GET /2/users/{source_user_id}/following/{target_user_id} but this does not exist.
            // We will use /users/:id/following and check if the target_id is in the response data array.
            
            const followingUrl = `https://api.twitter.com/2/users/${user.linkedXId}/following`;
            // If you need to check many, you would add `?max_results=1000` and handle pagination_token.
            // For a single check, this might be overkill but is a standard v2 way if no direct A->B check exists for user context.

            const response = await fetch(followingUrl, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.status === 401 && attempt === 0 && user.linkedXRefreshToken) { // Unauthorized, first attempt, and has refresh token
                console.log(`[Verify Follow] X Access token expired for user ${userId}. Attempting refresh.`);
                const decryptedRefreshToken = decrypt(user.linkedXRefreshToken);
                const newAccessToken = await refreshXAccessToken(decryptedRefreshToken, userId);
                if (newAccessToken) {
                    accessToken = newAccessToken;
                    attempt++; // Increment attempt, loop will retry with new token
                    continue;
                } else {
                    // Refresh failed, and tokens might have been cleared by refreshXAccessToken
                    return NextResponse.json({ error: 'Failed to refresh X token. Please try re-linking X account.', isLinked: true, follows: false, needsRelink: true }, { status: 401 });
                }
            } else if (!response.ok) {
                const errorData = await response.json();
                console.error(`[Verify Follow] Failed to fetch X following list for ${user.linkedXId}:`, errorData);
                throw new Error(errorData.title || 'Failed to verify follow status');
            }

            const followingData = await response.json();
            if (followingData.data && Array.isArray(followingData.data)) {
                followsTarget = followingData.data.some((followedUser: any) => followedUser.id === DEFAI_REWARDS_X_USER_ID);
            }
            break; // Success, exit loop

        } catch (error: any) {
            if (attempt + 1 >= maxAttempts) { // Last attempt failed
                console.error(`[Verify Follow] Error verifying X follow status for user ${userId} after ${maxAttempts} attempts:`, error);
                return NextResponse.json({ error: error.message || 'Could not verify follow status.', isLinked: true, follows: false }, { status: 500 });
            }
            // If not an auth error handled above, or other retryable error, could log and retry or fail.
            // For simplicity, we only explicitly retry on 401 with refresh token here.
            // If other errors, it will fall to the generic error after loop if break not hit.
            console.warn(`[Verify Follow] Attempt ${attempt + 1} failed for user ${userId}: ${error.message}. Retrying if applicable.`);
            attempt++; // Should not cause infinite loop due to maxAttempts
             if (attempt >= maxAttempts) throw error; // re-throw if it's the last attempt and not caught specifically to break
        }
    }

    // Update DB with follow status
    await usersCollection.updateOne(
        { _id: userId }, 
        { $set: { followsDefAIRewards: followsTarget, updatedAt: new Date() } }
    );

    return NextResponse.json({ 
        isLinked: true, 
        follows: followsTarget, 
        username: user.linkedXUsername, 
        targetAccount: DEFAI_REWARDS_X_USER_ID 
    });

} 