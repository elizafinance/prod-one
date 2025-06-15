import { NextResponse } from 'next/server';
import { connectToDatabase, SquadDocument } from '@/lib/mongodb';

// Default limit used when caller does not specify one.
// A value of 0 or the string "all" means "no limit" (return all squads).
const DEFAULT_LIMIT = 50;

export async function GET(request: Request) {
  try {
    // Parse limit query param
    const { searchParams } = new URL(request.url);
    const rawLimit = searchParams.get('limit');

    let effectiveLimit: number | null = DEFAULT_LIMIT;
    if (rawLimit !== null) {
      if (rawLimit.toLowerCase() === 'all' || rawLimit === '0') {
        effectiveLimit = null; // "no limit"
      } else {
        const parsed = parseInt(rawLimit, 10);
        if (!isNaN(parsed) && parsed > 0) {
          effectiveLimit = parsed;
        }
      }
    }

    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');

    // Build aggregation pipeline
    const pipeline: any[] = [
      // Stage 1: Lookup to join with users collection to get member details
      {
        $lookup: {
          from: 'users',
          localField: 'memberWalletAddresses',
          foreignField: 'walletAddress',
          as: 'memberDetails'
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
          calculatedMemberCount: { $size: '$memberWalletAddresses' },
          maxMembers: '$maxMembers',
          tier: '$tier'
        }
      },
      // Stage 3: Fallback to stored totalSquadPoints if calculated is 0 or missing
      {
        $addFields: {
          finalTotalSquadPoints: {
            $cond: [
              { $gt: ['$calculatedTotalSquadPoints', 0] },
              '$calculatedTotalSquadPoints',
              { $ifNull: ['$totalSquadPoints', 0] }
            ]
          }
        }
      },
      // Stage 4: Sort by final total points
      { $sort: { finalTotalSquadPoints: -1 } }
    ];

    // Stage 5: Apply limit if requested
    if (effectiveLimit !== null) {
      pipeline.push({ $limit: effectiveLimit });
    }

    // Stage 6: Final projection
    pipeline.push({
      $project: {
        _id: 0,
        squadId: 1,
        name: 1,
        description: 1,
        leaderWalletAddress: 1,
        totalSquadPoints: '$finalTotalSquadPoints',
        memberCount: '$calculatedMemberCount',
        maxMembers: '$maxMembers',
        tier: '$tier'
      }
    });

    const leaderboard = await squadsCollection.aggregate(pipeline).toArray();
    return NextResponse.json(leaderboard);

  } catch (error) {
    console.error('Error fetching squad leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch squad leaderboard data' }, { status: 500 });
  }
} 