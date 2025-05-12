import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';

const LEADERBOARD_LIMIT = 20; // Show top 20 users, for example

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');

    const leaderboard = await usersCollection
      .find({}, { projection: { walletAddress: 1, points: 1, highestAirdropTierLabel: 1, _id: 0 } }) // Select necessary fields
      .sort({ points: -1 }) // Sort by points descending
      .limit(LEADERBOARD_LIMIT)
      .toArray();

    // Simple masking for wallet addresses for display
    const maskedLeaderboard = leaderboard.map(user => {
      const originalWalletAddress = user.walletAddress;
      const maskedAddress = originalWalletAddress 
        ? `${originalWalletAddress.substring(0, 6)}...${originalWalletAddress.substring(originalWalletAddress.length - 4)}` 
        : "[No Wallet Address]";
      return {
        ...user, // Includes points and highestAirdropTierLabel
        walletAddress: maskedAddress
      };
    });

    return NextResponse.json(maskedLeaderboard);

  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
  }
} 