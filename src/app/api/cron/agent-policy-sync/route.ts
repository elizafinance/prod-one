import { NextRequest, NextResponse } from 'next/server';

/**
 * Vercel Scheduled Function entrypoint.
 * Simply invokes the agentPolicySync worker and returns basic JSON.
 */
export async function GET(req: NextRequest) {
  try {
    // Dynamically import to avoid unnecessary bundle cost on cold start
    const worker = await import('@/workers/agentPolicySync');
    // worker script auto-executes (has top-level main())
    return NextResponse.json({ success: true, message: 'agentPolicySync executed' });
  } catch (err:any) {
    console.error('[Cron agent-policy-sync] execution error', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal error' }, { status: 500 });
  }
}

// For Vercel cron, any method works; allow POST as well
export const POST = GET; 