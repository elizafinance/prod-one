import type { NextApiRequest, NextApiResponse } from 'next';

// Import the main cron function from the script.
// Note: We import the individual functions rather than executing the file directly to avoid side-effects at import time.
import { main as runProposalCron } from '@/scripts/cron/processProposals';

/**
 * API route to manually trigger the proposal processing cron job.
 *
 * Deployments on platforms like Vercel can schedule this endpoint
 * via `vercel.json` crons or invoke it on demand.
 *
 * Method: POST (no body required).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    await runProposalCron();

    return res.status(200).json({ message: 'Proposal processing cron executed successfully.' });
  } catch (error) {
    console.error('Error executing proposal cron:', error);
    return res.status(500).json({ error: 'Failed to execute proposal processing cron.' });
  }
} 