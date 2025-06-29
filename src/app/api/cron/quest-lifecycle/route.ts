import { NextResponse } from 'next/server';
import { questLifecycleService } from '@/services/questLifecycle.service';
import { CronJobLock } from '@/utils/cronLock';
import { withMonitoring } from '@/utils/functionMonitoring';

// Wrap the service calls with monitoring
const monitoredActivateQuests = withMonitoring(
  '/api/cron/quest-lifecycle/activate',
  questLifecycleService.activateScheduledQuests.bind(questLifecycleService)
);

const monitoredExpireQuests = withMonitoring(
  '/api/cron/quest-lifecycle/expire',
  questLifecycleService.expireOverdueQuests.bind(questLifecycleService)
);

// This endpoint can be triggered by the Vercel Cron Job
export async function GET() {
  const startTime = Date.now();
  console.log('[CRON - Quest Lifecycle] Job started.');
  
  try {
    // Use lock to prevent concurrent executions
    const result = await CronJobLock.withLock(
      'quest-lifecycle',
      async () => {
        // Set a timeout to ensure we don't run too long
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Quest lifecycle timeout after 8s')), 8000);
        });

        // Run the actual job with timeout
        const jobPromise = Promise.all([
          monitoredActivateQuests(),
          monitoredExpireQuests()
        ]);

        const [activationResult, expirationResult] = await Promise.race([
          jobPromise,
          timeoutPromise
        ]) as any;

        return { activationResult, expirationResult };
      },
      4 * 60 * 1000 // 4 minute lock duration (job runs every 5 minutes)
    );

    if (!result) {
      console.log('[CRON - Quest Lifecycle] Job skipped - another instance is running');
      return NextResponse.json({
        ok: true,
        message: 'Quest lifecycle job skipped - another instance is running.',
        skipped: true,
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[CRON - Quest Lifecycle] Job finished in ${duration}ms`, result);
    
    return NextResponse.json({
      ok: true,
      message: 'Quest lifecycle job completed successfully.',
      duration,
      ...result,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[CRON - Quest Lifecycle] Error running job after ${duration}ms:`, error);
    return NextResponse.json({ 
      ok: false, 
      message: error instanceof Error ? error.message : 'An error occurred during the quest lifecycle job.',
      duration 
    }, { status: 500 });
  }
} 