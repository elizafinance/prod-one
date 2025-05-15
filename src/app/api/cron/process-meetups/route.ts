import { NextResponse } from 'next/server';
import { processPendingMeetupCheckIns } from '@/services/meetupMatcher.service'; // Adjust path as necessary

// This is your secret token. It should be set as an environment variable.
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // Check for the secret token in the headers or query parameters
  // For Vercel Cron, you can pass it as a query parameter or a header if configured.
  // Example: GET /api/cron/process-meetups?secret=YOUR_SECRET_VALUE
  // Or Header: Authorization: Bearer YOUR_SECRET_VALUE

  const authHeader = request.headers.get('authorization');
  const secretFromHeader = authHeader?.split('Bearer ')?.[1];

  const { searchParams } = new URL(request.url);
  const secretFromQuery = searchParams.get('secret');

  if (!CRON_SECRET) {
    console.error('[Cron ProcessMeetups] CRON_SECRET is not set in environment variables.');
    return NextResponse.json({ error: 'Cron secret not configured on server.' }, { status: 500 });
  }

  if (secretFromHeader === CRON_SECRET || secretFromQuery === CRON_SECRET) {
    console.log('[Cron ProcessMeetups] Authorized cron job starting...');
    try {
      const result = await processPendingMeetupCheckIns();
      console.log('[Cron ProcessMeetups] Meetup processing completed.', result);
      return NextResponse.json({ success: true, message: 'Meetup check-ins processed.', details: result });
    } catch (error: any) {
      console.error('[Cron ProcessMeetups] Error during meetup processing:', error);
      return NextResponse.json({ success: false, error: 'Failed to process meetup check-ins', details: error.message }, { status: 500 });
    }
  } else {
    console.warn('[Cron ProcessMeetups] Unauthorized attempt to run cron job.');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
} 