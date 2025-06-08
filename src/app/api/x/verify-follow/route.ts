import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { decrypt, encrypt } from '@/lib/encryption'; // Import encrypt for refreshing token
import { ObjectId } from 'mongodb';

const DEFAI_REWARDS_X_USER_ID = process.env.DEFAI_REWARDS_X_USER_ID;
const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;

// Simple in-memory cache to reduce API calls
const followStatusCache = new Map<string, { follows: boolean; timestamp: number }>();
const CACHE_DURATION = process.env.NODE_ENV === 'development' 
    ? 10 * 60 * 1000  // 10 minutes in development
    : 5 * 60 * 1000;  // 5 minutes in production

// Clean up old cache entries periodically
const cleanupCache = () => {
    const now = Date.now();
    for (const [key, value] of followStatusCache.entries()) {
        if (now - value.timestamp > CACHE_DURATION) {
            followStatusCache.delete(key);
        }
    }
};

// Run cleanup every hour
setInterval(cleanupCache, 60 * 60 * 1000);

// Helper function to clear corrupted X tokens
async function clearXTokens(userId: ObjectId): Promise<void> {
    try {
        const { db } = await connectToDatabase();
        await db.collection<UserDocument>('users').updateOne(
            { _id: userId }, 
            { 
                $unset: { 
                    linkedXAccessToken: "", 
                    linkedXRefreshToken: "", 
                    linkedXScopes: "", 
                    linkedXConnectedAt: "" 
                } 
            }
        );
        console.log(`[ClearXTokens] Successfully cleared X tokens for user ${userId}`);
    } catch (error) {
        console.error(`[ClearXTokens] Error clearing X tokens for user ${userId}:`, error);
    }
}

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
                client_id: X_CLIENT_ID,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`[RefreshXToken] Failed to refresh X token for user ${userId}. Status: ${response.status}, Error:`, errorData);
            
            // If refresh fails (e.g., token revoked), clear the stored tokens
            if (response.status === 400 || response.status === 401) {
                await clearXTokens(userId);
                console.log(`[RefreshXToken] Cleared X tokens for user ${userId} due to refresh failure. This usually means the refresh token has expired or been revoked.`);
            }
            return null;
        }

        const newTokens = await response.json();
        const newAccessToken = newTokens.access_token;
        const newRefreshToken = newTokens.refresh_token;

        // Update the database with the new tokens (encrypted)
        const { db } = await connectToDatabase();
        await db.collection<UserDocument>('users').updateOne(
            { _id: userId }, 
            {
                $set: {
                    linkedXAccessToken: encrypt(newAccessToken),
                    ...(newRefreshToken && { linkedXRefreshToken: encrypt(newRefreshToken) }),
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

export async function POST(request: NextRequest) {
    console.log('[Verify Follow] API called');
    
    try {
        // Get session first
        const session = await getServerSession(authOptions);
        
        if (!session?.user?.id) {
            console.log('[Verify Follow] No session found');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        console.log(`[Verify Follow] Processing for user: ${userId}`);



        if (!DEFAI_REWARDS_X_USER_ID) {
            console.error('[Verify Follow] DEFAI_REWARDS_X_USER_ID not configured.');
            return NextResponse.json({ error: 'Target X account not configured on server.' }, { status: 500 });
        }

        const { db } = await connectToDatabase();
        const usersCollection = db.collection<UserDocument>('users');

        // Get user document
        const userDoc = await usersCollection.findOne({ _id: new ObjectId(session.user.dbId) });
        if (!userDoc) {
            console.log('[Verify Follow] User document not found');
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        if (!userDoc.linkedXId || !userDoc.linkedXAccessToken) {
            return NextResponse.json({ error: 'X account not linked or access token missing.', isLinked: false, follows: false }, { status: 400 });
        }

        // Check cache first to avoid hitting rate limits
        const cacheKey = `${userId.toString()}-defAIRewards`;
        const cached = followStatusCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
            console.log(`[Verify Follow] Using cached result for user ${userId}: ${cached.follows ? 'following' : 'not following'}`);
            
            // Update DB with cached status
            await usersCollection.updateOne(
                { _id: new ObjectId(session.user.dbId) }, 
                { $set: { followsDefAIRewards: cached.follows, updatedAt: new Date() } }
            );
            
            return NextResponse.json({ 
                isLinked: true, 
                follows: cached.follows, 
                username: userDoc.linkedXUsername, 
                targetAccount: 'defAIRewards',
                cached: true
            });
        }

        let accessToken;
        try {
            accessToken = decrypt(userDoc.linkedXAccessToken);
        } catch (error) {
            console.error(`[Verify Follow] Token decryption failed for user ${userId}:`, error);
            return NextResponse.json({ 
                error: 'Failed to decrypt access token. Please re-link X account.', 
                isLinked: true, 
                follows: false, 
                needsRelink: true 
            }, { status: 401 });
        }

        // If no access token after decryption
        if (!accessToken) {
            console.error(`[Verify Follow] Access token is empty after decryption for user ${userId}`);
            return NextResponse.json({ 
                error: 'Access token is invalid. Please re-link X account.', 
                isLinked: true, 
                follows: false, 
                needsRelink: true 
            }, { status: 401 });
        }

        let followsTarget = false;
        let attempt = 0;
        const maxAttempts = 2; // Initial attempt + 1 retry after refresh

        while (attempt < maxAttempts) {
            try {
                // Use username-based lookup for better rate limits (300 requests per 15 minutes vs 75 for ID-based)
                const userLookupUrl = `https://api.twitter.com/2/users/by/username/defAIRewards?user.fields=connection_status`;

                const response = await fetch(userLookupUrl, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });

                if (response.status === 401 && attempt === 0 && userDoc.linkedXRefreshToken) {
                    console.log(`[Verify Follow] Access token expired for user ${userId}, attempting refresh. Token connected at: ${userDoc.linkedXConnectedAt}`);
                    
                    try {
                    const decryptedRefreshToken = decrypt(userDoc.linkedXRefreshToken);
                    
                    const newAccessToken = await refreshXAccessToken(decryptedRefreshToken, userId);
                    if (newAccessToken) {
                        accessToken = newAccessToken;
                        attempt++;
                        continue;
                    } else {
                            await clearXTokens(userId);
                            return NextResponse.json({ 
                                error: 'Failed to refresh X token. The refresh token may be expired. Please re-link your X account.', 
                                isLinked: false, 
                                follows: false, 
                                needsRelink: true,
                                reason: 'refresh_failed'
                            }, { status: 401 });
                        }
                    } catch (decryptError) {
                        console.error(`[Verify Follow] Failed to decrypt refresh token for user ${userId}:`, decryptError);
                        await clearXTokens(userId);
                        return NextResponse.json({ 
                            error: 'X token data is corrupted. Please re-link your X account.', 
                            isLinked: false, 
                            follows: false, 
                            needsRelink: true,
                            reason: 'token_corruption'
                        }, { status: 401 });
                    }
                } else if (response.status === 401 && !userDoc.linkedXRefreshToken) {
                    console.error(`[Verify Follow] Access token invalid and no refresh token available for user ${userId}. Connected at: ${userDoc.linkedXConnectedAt}, Scopes: ${userDoc.linkedXScopes}`);
                    await clearXTokens(userId);
                    
                    return NextResponse.json({ 
                        error: 'X authentication has expired and cannot be refreshed. Your X account was linked before refresh tokens were properly configured. Please re-link your X account.', 
                        isLinked: false,
                        follows: false, 
                        needsRelink: true,
                        reason: 'missing_refresh_token'
                    }, { status: 401 });
                } else if (response.status === 429) {
                    // Rate limit hit - check retry-after header
                    const retryAfter = response.headers.get('x-rate-limit-reset');
                    const rateLimitRemaining = response.headers.get('x-rate-limit-remaining');
                    
                    console.warn(`[Verify Follow] Rate limit exceeded for user ${userId}. Remaining: ${rateLimitRemaining}, Reset: ${retryAfter}`);
                    
                    return NextResponse.json({ 
                        error: 'X API rate limit exceeded. Please try again in a few minutes.', 
                        isLinked: true, 
                        follows: false,
                        rateLimited: true,
                        retryAfter: retryAfter 
                    }, { status: 429 });
                } else if (!response.ok) {
                    const errorData = await response.json();
                    console.error(`[Verify Follow] Failed to fetch X user connection status for ${DEFAI_REWARDS_X_USER_ID}:`, errorData);
                    throw new Error(errorData.title || 'Failed to verify follow status');
                }

                const userData = await response.json();
                
                // Check if the authenticated user is following the target user
                if (userData.data && userData.data.connection_status) {
                    followsTarget = userData.data.connection_status.includes('following');
                    console.log(`[Verify Follow] User ${userId} follow status: ${followsTarget ? 'following' : 'not following'} @defAIRewards`);
                } else {
                    followsTarget = false;
                    console.log(`[Verify Follow] No connection status found for user ${userId}, assuming not following`);
                }
                
                // Cache the result to reduce future API calls
                followStatusCache.set(cacheKey, { 
                    follows: followsTarget, 
                    timestamp: Date.now() 
                });
                
                break; // Success, exit loop

            } catch (error: any) {
                if (attempt + 1 >= maxAttempts) {
                    console.error(`[Verify Follow] Error verifying follow status for user ${userId} after ${maxAttempts} attempts:`, error);
                    return NextResponse.json({ 
                        error: error.message || 'Could not verify follow status.', 
                        isLinked: true, 
                        follows: false 
                    }, { status: 500 });
                }
                
                console.warn(`[Verify Follow] Attempt ${attempt + 1} failed for user ${userId}: ${error.message}. Retrying...`);
                attempt++;
                
                if (attempt >= maxAttempts) throw error;
            }
        }

        // Update DB with follow status  
        await usersCollection.updateOne(
            { _id: new ObjectId(session.user.dbId) }, 
            { $set: { followsDefAIRewards: followsTarget, updatedAt: new Date() } }
        );

        return NextResponse.json({ 
            isLinked: true, 
            follows: followsTarget, 
            username: userDoc.linkedXUsername, 
            targetAccount: 'defAIRewards' 
        });

    } catch (error) {
        console.error(`[Verify Follow] Error processing request:`, error);
        return NextResponse.json({ error: 'An error occurred while processing the request.' }, { status: 500 });
    }
} 