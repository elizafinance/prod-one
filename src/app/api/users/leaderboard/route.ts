import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { NextRequest } from 'next/server';

// const LEADERBOARD_LIMIT = 20; // Default limit, can be overridden by query param

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const skip = (page - 1) * limit;

    if (page < 1) return NextResponse.json({ error: 'Page number must be 1 or greater' }, { status: 400 });
    if (limit < 1 || limit > 100) return NextResponse.json({ error: 'Limit must be between 1 and 100' }, { status: 400 });

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');

    const query = { points: { $gt: 0 } }; // Only users with points > 0

    const allUsersWithPoints = await usersCollection.find(query, {
        projection: { 
          walletAddress: 1, 
          points: 1, 
          highestAirdropTierLabel: 1,
          xUsername: 1,
          xProfileImageUrl: 1,
          earnedBadgeIds: 1,
          _id: 0 
        } 
      })
      .sort({ points: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalUsersWithPoints = await usersCollection.countDocuments(query);
    const totalPages = Math.ceil(totalUsersWithPoints / limit);

    const maskedLeaderboard = allUsersWithPoints.map(user => {
      const originalWalletAddress = user.walletAddress;
      const maskedAddress = originalWalletAddress 
        ? `${originalWalletAddress.substring(0, 6)}...${originalWalletAddress.substring(originalWalletAddress.length - 4)}` 
        : "[No Wallet Address]";
      return {
        ...user,
        walletAddress: maskedAddress
      };
    });

    return NextResponse.json({
      leaderboard: maskedLeaderboard,
      currentPage: page,
      totalPages,
      totalEntries: totalUsersWithPoints,
      limit,
    });

  } catch (error) {
    console.error("Error fetching leaderboard data:", error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
  }
} 