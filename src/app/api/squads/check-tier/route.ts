import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { SquadTierService } from '@/services/squadTierService';
import { connectToDatabase, SquadDocument } from '@/lib/mongodb';

// GET endpoint to check a squad's tier eligibility
const getHandler = withAuth(async (request: Request, session) => {
  try {
    const url = new URL(request.url);
    const squadId = url.searchParams.get('squadId');

    if (!squadId) {
      return NextResponse.json({ error: 'squadId parameter is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');

    // Check if user is a member of the squad
    const squad = await squadsCollection.findOne({ squadId });
    if (!squad) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const isMember = squad.memberWalletAddresses.includes(session.user.walletAddress) || 
                     squad.leaderWalletAddress === session.user.walletAddress;
    
    if (!isMember) {
      return NextResponse.json({ error: 'You must be a member of the squad to check its tier' }, { status: 403 });
    }

    // Get tier progress
    const tierProgress = await SquadTierService.getSquadTierProgress(squadId);
    
    return NextResponse.json({
      success: true,
      squadId,
      tierProgress
    });

  } catch (error) {
    console.error('[Check Squad Tier] Error:', error);
    return NextResponse.json({ error: 'Failed to check squad tier' }, { status: 500 });
  }
});

// POST endpoint to manually trigger tier update for a squad
const postHandler = withAuth(async (request: Request, session) => {
  try {
    const { squadId } = await request.json();

    if (!squadId) {
      return NextResponse.json({ error: 'squadId is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');

    // Check if user is the leader of the squad
    const squad = await squadsCollection.findOne({ squadId });
    if (!squad) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    if (squad.leaderWalletAddress !== session.user.walletAddress && session.user.role !== 'admin') {
      return NextResponse.json({ 
        error: 'Only the squad leader or admin can trigger tier updates' 
      }, { status: 403 });
    }

    // Check and update tier
    const updateResult = await SquadTierService.checkAndUpdateSquadTier(squadId);

    if (updateResult.updated) {
      return NextResponse.json({
        success: true,
        message: `Squad tier upgraded from ${updateResult.oldTier} to ${updateResult.newTier}`,
        oldTier: updateResult.oldTier,
        newTier: updateResult.newTier,
        oldMaxMembers: updateResult.oldMaxMembers,
        newMaxMembers: updateResult.newMaxMembers
      });
    } else {
      // Get current tier info
      const tierProgress = await SquadTierService.getSquadTierProgress(squadId);
      
      return NextResponse.json({
        success: true,
        message: 'Squad is already at the appropriate tier',
        tierProgress
      });
    }

  } catch (error) {
    console.error('[Update Squad Tier] Error:', error);
    return NextResponse.json({ error: 'Failed to update squad tier' }, { status: 500 });
  }
});

export const GET = getHandler;
export const POST = postHandler;