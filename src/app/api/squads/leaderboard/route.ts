import { NextResponse } from 'next/server';
import { connectToDatabase, SquadDocument, UserDocument } from '@/lib/mongodb';

const SQUAD_LEADERBOARD_LIMIT = 50; // Example limit

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');

    // MongoDB Aggregation Pipeline
    const leaderboard = await squadsCollection.aggregate([
      // Stage 1: Lookup to join with users collection to get member details
      {
        $lookup: {
          from: 'users', // The collection to join
          localField: 'memberWalletAddresses', // Field from the input documents (squads)
          foreignField: 'walletAddress', // Field from the documents of the "from" collection (users)
          as: 'memberDetails' // Output array field
        }
      },
      // Stage 2: Calculate total points and member count
      {
        $addFields: {
          calculatedTotalSquadPoints: {
            $sum: {
              $map: {
                input: '$memberDetails',
                as: 'm',
                in: {
                  $cond: [ { $isNumber: '$$m.points' }, '$$m.points', { $toInt: '$$m.points' } ]
                }
              }
            }
          },
          calculatedMemberCount: {
            $size: '$memberWalletAddresses' // Count members based on the wallet addresses array
          },
          maxMembers: '$maxMembers',
          tier: '$tier'
        }
      },
      // Stage 3: Sort by the calculated total points
      {
        $sort: { calculatedTotalSquadPoints: -1 }
      },
      // Stage 4: Limit the results
      {
        $limit: SQUAD_LEADERBOARD_LIMIT
      },
      // Stage 5: Project the final desired fields
      {
        $project: {
          _id: 0, // Exclude the default MongoDB _id
          squadId: 1,
          name: 1,
          description: 1,
          leaderWalletAddress: 1,
          totalSquadPoints: '$calculatedTotalSquadPoints', // Rename for client consistency
          memberCount: '$calculatedMemberCount', // Rename for client consistency
          maxMembers: '$maxMembers',
          tier: '$tier'
          // Note: memberDetails array is not projected to keep payload smaller
        }
      }
    ]).toArray();

    return NextResponse.json(leaderboard);

  } catch (error) {
    console.error("Error fetching squad leaderboard:", error);
    return NextResponse.json({ error: 'Failed to fetch squad leaderboard data' }, { status: 500 });
  }
} 