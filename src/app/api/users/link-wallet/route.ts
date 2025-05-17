import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import type { Session } from 'next-auth'; // Import Session type correctly
import { authOptions } from "@/lib/auth"; // Assuming your authOptions are here
import { connectToDatabase, UserDocument } from "@/lib/mongodb"; // Assuming mongodb connection and UserDocument type
import { FindOneAndUpdateOptions, WithId } from 'mongodb'; // ModifyResult for findOneAndUpdate

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions) as Session | null; // Cast to Session from next-auth

    if (!session || !session.user || !session.user.xId) {
      return NextResponse.json({ error: 'User not authenticated or xId missing from session.' }, { status: 401 });
    }

    const { walletAddress } = await request.json();

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Wallet address is required and must be a string.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const xUserId = session.user.xId; // xId should be string here due to the check above

    // Check if this wallet address is already linked to a *different* xUserId
    const existingUserWithWallet = await usersCollection.findOne({ 
      walletAddress: walletAddress,
      xUserId: { $ne: xUserId } 
    });

    if (existingUserWithWallet) {
      return NextResponse.json({ error: 'This wallet is already associated with another X account.' }, { status: 409 }); // 409 Conflict
    }

    const options: FindOneAndUpdateOptions = {
      returnDocument: 'after',
      upsert: false
    };

    // Find the current user by xUserId and update their walletAddress
    // The result of findOneAndUpdate when returnDocument is 'after' includes a `value` field with the document or null
    const updatedUserDocument: WithId<UserDocument> | null = await usersCollection.findOneAndUpdate(
      { xUserId: xUserId },
      { 
        $set: { 
          walletAddress: walletAddress,
          updatedAt: new Date() 
        },
        $addToSet: { completedActions: 'wallet_connected' } // Optionally track this action
      },
      options
    );

    // Check if the document was found and updated
    if (!updatedUserDocument) {
      console.error(`[Link Wallet] Failed to find and update user for xUserId: ${xUserId}.`);
      return NextResponse.json({ error: 'Failed to link wallet. User not found or update operation failed.' }, { status: 404 });
    }
    
    // updatedUserDocument contains the updated document
    const updatedUser: UserDocument = updatedUserDocument;

    console.log(`[Link Wallet] Successfully linked wallet ${walletAddress} to xUserId ${xUserId}`);
    return NextResponse.json({ 
      message: 'Wallet linked successfully.', 
      user: updatedUser 
    });

  } catch (error: any) {
    console.error('[Link Wallet] Error linking wallet:', error);
    return NextResponse.json({ error: 'Internal server error while linking wallet.', details: error.message }, { status: 500 });
  }
} 