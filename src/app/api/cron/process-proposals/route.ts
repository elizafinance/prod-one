import { NextResponse } from 'next/server';
import { main as processProposalsMain } from '@/scripts/cron/processProposals'; // Adjust path if necessary

// It's good practice to secure cron job endpoints, e.g., with a secret key or by checking an internal header Vercel might add.
// For simplicity, this example is open, but consider adding authorization.
// const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // Optional: Add authorization check
  // const authHeader = request.headers.get('authorization');
  // if (authHeader !== `Bearer ${CRON_SECRET}`) {
  //   return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  // }

  console.log('[API Cron] /api/cron/process-proposals endpoint hit, triggering proposal processing...');
  try {
    await processProposalsMain();
    console.log('[API Cron] Proposal processing job triggered successfully via API.');
    return NextResponse.json({ message: 'Proposal processing job triggered successfully.' });
  } catch (error) {
    console.error('[API Cron] Error triggering proposal processing job:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ message: 'Error triggering proposal processing job.', error: errorMessage }, { status: 500 });
  }
} 