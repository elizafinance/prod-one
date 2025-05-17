import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ensureMongooseConnected } from '@/lib/mongooseConnect';
import { Proposal } from '@/models/Proposal';
import { Vote } from '@/models/Vote';
import { Squad } from '@/models/Squad'; 
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMongooseConnected();
  } catch (err) {
    console.error('[CancelAPI] Failed to establish Mongoose connection:', err);
    return res.status(500).json({ error: 'Database connection error.' });
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Ensure user is authenticated
  const session = await getServerSession(req, res, authOptions) as any;
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const { proposalId } = req.query;
  if (typeof proposalId !== 'string' || proposalId.trim() === '') {
    return res.status(400).json({ error: 'Proposal identifier is required' });
  }

  try {
    let proposal = null;
    let proposalObjectId: Types.ObjectId | null = null;

    if (Types.ObjectId.isValid(proposalId)) {
      proposalObjectId = new Types.ObjectId(proposalId);
      proposal = await Proposal.findById(proposalObjectId);
    }

    if (!proposal) {
      proposal = await Proposal.findOne({ slug: proposalId });
      if (proposal) proposalObjectId = proposal._id as unknown as Types.ObjectId;
    }

    // Find the proposal
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Check if proposal is still active
    if (proposal.status !== 'active') {
      return res.status(400).json({ error: 'Only active proposals can be cancelled' });
    }

    // Get the squad to verify leader
    const squad = await Squad.findById(proposal.squadId);
    if (!squad) {
      console.error(`[CancelAPI] Squad not found for proposal ${proposalId}`);
      return res.status(404).json({ error: 'Squad not found for this proposal' });
    }

    // Verify user is the squad leader
    if (squad.leaderWalletAddress !== session.user.walletAddress) {
      return res.status(403).json({ error: 'Only the squad leader can cancel proposals' });
    }

    // Check if there are any votes on this proposal
    const voteCount = await Vote.countDocuments({ proposalId: proposalObjectId });
    if (voteCount > 0) {
      return res.status(400).json({ error: 'Cannot cancel a proposal that has votes' });
    }

    // All checks passed - cancel the proposal
    proposal.status = 'cancelled';
    await proposal.save();

    return res.status(200).json({ 
      message: 'Proposal successfully cancelled',
      proposalId: proposal._id.toString()
    });
  } catch (error: any) {
    console.error('[CancelAPI] Error cancelling proposal:', error);
    return res.status(500).json({ 
      error: error.message || 'Error cancelling proposal' 
    });
  }
} 