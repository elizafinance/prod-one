import { NextResponse } from 'next/server';
import { questLifecycleService } from '@/services/questLifecycle.service';

// This endpoint can be triggered by the Vercel Cron Job
export async function GET() {
  console.log('[CRON - Quest Lifecycle] Job started.');
  try {
    // We can run both functions in parallel for efficiency
    const [activationResult, expirationResult] = await Promise.all([
      questLifecycleService.activateScheduledQuests(),
      questLifecycleService.expireOverdueQuests()
    ]);

    console.log('[CRON - Quest Lifecycle] Job finished.', { activationResult, expirationResult });
    
    return NextResponse.json({
      ok: true,
      message: 'Quest lifecycle job completed successfully.',
      activationResult,
      expirationResult,
    });
  } catch (error) {
    console.error('[CRON - Quest Lifecycle] Error running job:', error);
    return NextResponse.json({ ok: false, message: 'An error occurred during the quest lifecycle job.' }, { status: 500 });
  }
} 