import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { decrypt } from '@/lib/encryption'; // To get token for revocation
import { ObjectId } from 'mongodb';

const X_CLIENT_ID = process.env.X_CLIENT_ID;
// Client Secret might not be strictly needed for revoke if using Bearer token directly, 
// but some OAuth flows require client auth for revocation.
// X's /2/oauth2/revoke endpoint supports token passed directly or basic client auth.
// We will try with the token itself first.

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.dbId) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  const userId = new ObjectId(session.user.dbId);
  const { db } = await connectToDatabase();
  const usersCollection = db.collection<UserDocument>('users');

  try {
    const user = await usersCollection.findOne({ _id: userId });

    if (!user || !user.linkedXAccessToken) {
      return NextResponse.json({ error: 'No X account linked or access token missing.' }, { status: 400 });
    }

    const accessTokenToRevoke = decrypt(user.linkedXAccessToken);

    // 1. Attempt to revoke the token with X
    // X API v2: POST /2/oauth2/revoke (takes token and client_id or client_id + client_secret)
    if (X_CLIENT_ID && accessTokenToRevoke) {
      try {
        const revokeResponse = await fetch('https://api.twitter.com/2/oauth2/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            // Basic Auth for client credentials is also an option for confidential clients
            // 'Authorization': `Basic ${Buffer.from(`${X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString('base64')}`,
          },
          body: new URLSearchParams({
            token: accessTokenToRevoke,
            client_id: X_CLIENT_ID, 
            token_type_hint: 'access_token' // Recommended by OAuth 2.0 Token Revocation spec
          }),
        });
        
        if (revokeResponse.ok) {
          const revokeData = await revokeResponse.json();
          if (revokeData.revoked) {
            console.log(`[X Disconnect] Successfully revoked X token for user ${userId}`);
          } else {
            // Token might have already been invalid, or some other non-critical issue with revoke
            console.warn(`[X Disconnect] X token revocation endpoint returned ok but revoked:false for user ${userId}. Proceeding with DB cleanup.`);
          }
        } else {
          // Log error but proceed with DB cleanup, as user intent is to disconnect from our app
          const errorData = await revokeResponse.text(); // Use .text() for potentially non-JSON error responses
          console.warn(`[X Disconnect] Failed to revoke X token for user ${userId}. Status: ${revokeResponse.status}. Error: ${errorData}. Proceeding with DB cleanup.`);
        }
      } catch (revokeError: any) {
        console.error(`[X Disconnect] Exception during X token revocation for user ${userId}:`, revokeError.message);
        // Proceed with DB cleanup even if revocation fails
      }
    }

    // 2. Remove X-related fields from the user's document in the database
    const updateResult = await usersCollection.updateOne(
      { _id: userId },
      {
        $unset: {
          linkedXId: "",
          linkedXUsername: "",
          linkedXProfileImageUrl: "",
          linkedXAccessToken: "",
          linkedXRefreshToken: "",
          linkedXScopes: "",
          linkedXConnectedAt: "",
          followsDefAIRewards: "", // Also reset follow status
        },
        $set: {
            updatedAt: new Date(),
        }
      }
    );

    if (updateResult.modifiedCount === 0 && updateResult.matchedCount === 0) {
      // This case should ideally be caught by the check for user earlier
      return NextResponse.json({ error: 'User not found or X account not linked.' }, { status: 404 });
    }
    
    console.log(`[X Disconnect] Successfully disconnected X account for user ${userId} from database.`);
    return NextResponse.json({ success: true, message: 'X account disconnected successfully.' });

  } catch (error: any) {
    console.error(`[X Disconnect] General error for user ${session.user.dbId}:`, error);
    return NextResponse.json({ error: 'Failed to disconnect X account.', details: error.message }, { status: 500 });
  }
} 