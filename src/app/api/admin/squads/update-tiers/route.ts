import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { SquadTierService } from '@/services/squadTierService';

const postHandler = withAuth(async (request: Request, session) => {
  try {
    // Verify user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    console.log('[Admin] Starting batch squad tier update...');

    // Run the batch update
    const result = await SquadTierService.updateAllSquadTiers();

    console.log('[Admin] Batch squad tier update complete:', result);

    return NextResponse.json({
      success: true,
      message: `Updated ${result.totalUpdated} out of ${result.totalChecked} squads`,
      ...result
    });

  } catch (error) {
    console.error('[Admin Squad Tier Update] Error:', error);
    return NextResponse.json({ error: 'Failed to update squad tiers' }, { status: 500 });
  }
});

export const POST = postHandler;