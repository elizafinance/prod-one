import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions) as Session | null;

  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated or wallet address not found in session' }, { status: 401 });
  }

  const userWalletAddress = session.user.walletAddress;

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');

    // Aggregation pipeline to determine rank
    // Stage 1: Filter users with points > 0 (optional, depends if rank includes users with 0 points)
    // Stage 2: Sort by points descending, then by _id ascending as a tie-breaker (optional)
    // Stage 3: Group all users and push them into an array with their original document
    // Stage 4: Unwind the array
    // Stage 5: Add an index (rank) to each document
    // Stage 6: Match the current user
    // Stage 7: Project the desired fields (rank, points, etc.)

    const aggregationResult = await usersCollection.aggregate([
      {
        $match: { points: { $gt: 0 } } // Consider only users with points
      },
      {
        $sort: { points: -1, _id: 1 } // Sort by points, then by _id for consistent tie-breaking
      },
      {
        $group: {
          _id: null, // Group all documents into a single group
          users: { $push: "$$ROOT" } // Push all fields of each user into an array
        }
      },
      {
        $unwind: { 
          path: "$users", 
          includeArrayIndex: "rank" // Output the array index as 'rank' (0-based)
        }
      },
      {
        $match: { "users.walletAddress": userWalletAddress }
      },
      {
        $project: {
          _id: "$users._id",
          walletAddress: "$users.walletAddress",
          xUsername: "$users.xUsername",
          points: "$users.points",
          rank: { $add: ["$rank", 1] } // Convert 0-based index to 1-based rank
        }
      }
    ]).toArray();

    if (aggregationResult.length === 0) {
      // User might have 0 points or not be found in the ranked list
      // Fetch their points separately to provide some info
      const currentUser = await usersCollection.findOne({ walletAddress: userWalletAddress }, { projection: { points: 1 } });
      return NextResponse.json({
        message: 'User not found in leaderboard ranks (possibly 0 points or new user).',
        rank: null,
        points: currentUser?.points ?? 0,
        walletAddress: userWalletAddress
      });
    }

    const userRankDetails = aggregationResult[0];

    // Get total number of ranked users for context
    const totalRankedUsers = await usersCollection.countDocuments({ points: { $gt: 0 } });

    return NextResponse.json({
      ...userRankDetails,
      totalRankedUsers
    });

  } catch (error) {
    console.error("Error fetching user rank:", error);
    return NextResponse.json({ error: 'Failed to fetch user rank' }, { status: 500 });
  }
} 