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

    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Check if X account is linked by checking for any X-related fields
    const hasXData = user.linkedXId || user.linkedXUsername || user.linkedXAccessToken;
    
    if (!hasXData) {
      console.log(`[X Disconnect] No X account data found for user ${userId}. May have been already cleared.`);
      return NextResponse.json({ 
        success: true, 
        message: 'X account is already disconnected.',
        alreadyDisconnected: true 
      });
    }

    let accessTokenToRevoke = null;
    
    // Try to decrypt access token if it exists
    if (user.linkedXAccessToken) {
      try {
        accessTokenToRevoke = decrypt(user.linkedXAccessToken);
      } catch (error) {
        console.warn(`[X Disconnect] Failed to decrypt access token for user ${userId}, proceeding with cleanup:`, error);
      }
    }

    // 1. Attempt to revoke the token with X (if we have a valid token)
    if (X_CLIENT_ID && accessTokenToRevoke) {
      try {
        const revokeResponse = await fetch('https://api.twitter.com/2/oauth2/revoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
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
            console.warn(`[X Disconnect] X token revocation endpoint returned ok but revoked:false for user ${userId}. Proceeding with DB cleanup.`);
          }
        } else {
          const errorData = await revokeResponse.text();
          console.warn(`[X Disconnect] Failed to revoke X token for user ${userId}. Status: ${revokeResponse.status}. Error: ${errorData}. Proceeding with DB cleanup.`);
        }
      } catch (revokeError: any) {
        console.error(`[X Disconnect] Exception during X token revocation for user ${userId}:`, revokeError.message);
      }
    } else {
      console.log(`[X Disconnect] No valid access token to revoke for user ${userId}, proceeding with DB cleanup.`);
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

    console.log(`[X Disconnect] Successfully cleaned X account data for user ${userId} from database. Modified count: ${updateResult.modifiedCount}`);
    return NextResponse.json({ 
      success: true, 
      message: 'X account disconnected successfully.',
      tokenRevoked: !!accessTokenToRevoke,
      dataCleared: updateResult.modifiedCount > 0
    });

  } catch (error: any) {
    console.error(`[X Disconnect] General error for user ${session.user.dbId}:`, error);
    return NextResponse.json({ error: 'Failed to disconnect X account.', details: error.message }, { status: 500 });
  }
} 