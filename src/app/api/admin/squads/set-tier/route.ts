import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { connectToDatabase, SquadDocument } from '@/lib/mongodb';

const TIER_MAX_MEMBERS: Record<number, number> = {
  1: parseInt(process.env.TIER_1_MAX_MEMBERS || '10'),
  2: parseInt(process.env.TIER_2_MAX_MEMBERS || '50'),
  3: parseInt(process.env.TIER_3_MAX_MEMBERS || '100'),
};

const postHandler = withAuth(async (request: Request, session) => {
  try {
    // Verify user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { squadId, tier } = await request.json();

    // Validate inputs
    if (!squadId) {
      return NextResponse.json({ error: 'squadId is required' }, { status: 400 });
    }

    if (typeof tier !== 'number' || tier < 0 || tier > 3) {
      return NextResponse.json({ error: 'tier must be a number between 0 and 3' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');

    // Get current squad
    const squad = await squadsCollection.findOne({ squadId });
    if (!squad) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const oldTier = squad.tier || 0;
    const oldMaxMembers = squad.maxMembers || 0;
    const newMaxMembers = TIER_MAX_MEMBERS[tier] || 0;

    // Update squad tier
    const updateResult = await squadsCollection.updateOne(
      { squadId },
      {
        $set: {
          tier: tier,
          maxMembers: newMaxMembers,
          updatedAt: new Date()
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes made - squad was already at this tier',
        squadId,
        tier,
        maxMembers: newMaxMembers
      });
    }

    console.log(
      `[Admin] Squad ${squadId} tier manually set from ${oldTier} to ${tier}, ` +
      `max members changed from ${oldMaxMembers} to ${newMaxMembers} by admin ${session.user.walletAddress}`
    );

    return NextResponse.json({
      success: true,
      message: `Squad tier updated from ${oldTier} to ${tier}`,
      squadId,
      oldTier,
      newTier: tier,
      oldMaxMembers,
      newMaxMembers,
      squadName: squad.name,
      currentPoints: squad.totalSquadPoints || 0
    });

  } catch (error) {
    console.error('[Admin Set Squad Tier] Error:', error);
    return NextResponse.json({ error: 'Failed to update squad tier' }, { status: 500 });
  }
});

export const POST = postHandler;