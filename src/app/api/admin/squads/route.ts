import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { connectToDatabase, SquadDocument } from '@/lib/mongodb';

const getHandler = withAuth(async (request: Request, session) => {
  try {
    // Verify user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');

    // Get all squads with aggregation to include member count
    const squads = await squadsCollection.aggregate([
      {
        $addFields: {
          memberCount: { $size: '$memberWalletAddresses' }
        }
      },
      {
        $project: {
          squadId: 1,
          name: 1,
          totalSquadPoints: 1,
          tier: 1,
          maxMembers: 1,
          memberCount: 1,
          leaderWalletAddress: 1,
          createdAt: 1,
          updatedAt: 1
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]).toArray();

    // Ensure default values for missing fields
    const processedSquads = squads.map(squad => ({
      ...squad,
      tier: squad.tier || 0,
      maxMembers: squad.maxMembers || 0,
      totalSquadPoints: squad.totalSquadPoints || 0,
      memberCount: squad.memberCount || 0
    }));

    return NextResponse.json({
      success: true,
      squads: processedSquads,
      total: processedSquads.length
    });

  } catch (error) {
    console.error('[Admin Squads] Error fetching squads:', error);
    return NextResponse.json({ error: 'Failed to fetch squads' }, { status: 500 });
  }
});

export const GET = getHandler;