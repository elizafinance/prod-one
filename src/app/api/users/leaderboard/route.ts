import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { NextRequest } from 'next/server';

// const LEADERBOARD_LIMIT = 20; // Default limit, can be overridden by query param

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageParam = searchParams.get('page') || '1';
    const limitParam = searchParams.get('limit') || '20';

    const page = parseInt(pageParam, 10);
    let limit: number;

    // Allow client to request the entire list via limit=all or limit=0
    if (limitParam.toLowerCase() === 'all' || limitParam === '0') {
      limit = 0; // 0 will mean "no limit" in our logic below
    } else {
      limit = parseInt(limitParam, 10);
    }

    const skip = limit > 0 ? (page - 1) * limit : 0;

    if (page < 1) return NextResponse.json({ error: 'Page number must be 1 or greater' }, { status: 400 });
    if (limit < 0) return NextResponse.json({ error: 'Limit must be 0, "all", or a positive integer' }, { status: 400 });
    if (limit > 1000) return NextResponse.json({ error: 'Limit too large (max 1000)' }, { status: 400 });

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');

    const query = { points: { $gt: 0 } }; // Only users with points > 0

    // Build the cursor with optional pagination
    let cursor = usersCollection.find(query, {
        projection: { 
          walletAddress: 1, 
          points: 1, 
          highestAirdropTierLabel: 1,
          xUsername: 1,
          xProfileImageUrl: 1,
          earnedBadgeIds: 1,
          _id: 0 
        } 
      }).sort({ points: -1 });

    if (limit > 0) {
      cursor = cursor.skip(skip).limit(limit);
    }

    const allUsersWithPoints = await cursor.toArray();

    const totalUsersWithPoints = await usersCollection.countDocuments(query);
    const totalPages = limit > 0 ? Math.ceil(totalUsersWithPoints / limit) : 1;

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