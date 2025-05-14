import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { UserDocument } from '@/lib/mongodb';
import { ensureMongooseConnected } from '@/lib/mongooseConnect';
import { Proposal, IProposal } from '@/models/Proposal';
import { Vote, IVote } from '@/models/Vote';
import { Squad, ISquad } from '@/models/Squad';
import { Notification } from '@/models/Notification';
import { Types } from 'mongoose';
import mongoose from 'mongoose';

const MIN_POINTS_TO_VOTE = parseInt(process.env.NEXT_PUBLIC_MIN_POINTS_TO_VOTE || "500", 10);
const BROADCAST_THRESHOLD = parseInt(process.env.NEXT_PUBLIC_PROPOSAL_BROADCAST_THRESHOLD || "1000", 10);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMongooseConnected();
  } catch (err) {
    console.error('Failed to establish Mongoose connection in vote API route:', err);
    return res.status(500).json({ error: 'Database connection error.' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || typeof session.user.walletAddress !== 'string' || !session.user.dbId) {
    return res.status(401).json({ error: 'User not authenticated, wallet, or user ID missing from session' });
  }
  const voterWalletAddress = session.user.walletAddress;
  const voterUserId = new Types.ObjectId(session.user.dbId);

  const { proposalId } = req.query;

  if (req.method === 'POST') {
    if (typeof proposalId !== 'string' || !Types.ObjectId.isValid(proposalId)) {
      return res.status(400).json({ error: 'Valid Proposal ID is required.' });
    }

    const { choice } = req.body;
    if (!choice || !['up', 'down', 'abstain'].includes(choice)) {
      return res.status(400).json({ error: 'Invalid vote choice. Must be one of: up, down, abstain.' });
    }

    try {
      const Users = mongoose.model<UserDocument>('User');
      
      const voter = await Users.findById(voterUserId).lean();
      if (!voter) {
        return res.status(404).json({ error: 'Voter not found.' });
      }

      if ((voter.points || 0) < MIN_POINTS_TO_VOTE) {
        return res.status(403).json({ error: `You need at least ${MIN_POINTS_TO_VOTE} points to vote.` });
      }

      const proposalObjectId = new Types.ObjectId(proposalId);
      const proposal = await Proposal.findById(proposalObjectId);
      if (!proposal) {
        return res.status(404).json({ error: 'Proposal not found.' });
      }

      if (proposal.status !== 'active') {
        return res.status(403).json({ error: 'Voting is only allowed on active proposals.' });
      }
      
      // Check if epoch has ended
      const now = new Date();
      if (now >= proposal.epochEnd) {
        return res.status(403).json({ error: 'The voting period for this proposal has ended.' });
      }

      // Check if voter is a member of the squad that created the proposal
      const squad = await Squad.findById(proposal.squadId);
      if (!squad) {
        console.error(`Consistency error: Squad with ID ${proposal.squadId} not found for proposal ${proposal._id}`);
        return res.status(500).json({ error: 'Internal server error: Squad data missing.' });
      }
      if (!squad.memberWalletAddresses.includes(voterWalletAddress)) {
        return res.status(403).json({ error: 'You must be a member of the squad to vote on this proposal.' });
      }

      const voterPointsAtCast = voter.points || 0;

      const newVote = new Vote({
        proposalId: proposalObjectId,
        voterUserId,
        voterWallet: voterWalletAddress,
        squadId: proposal.squadId, // Store squadId from the proposal for convenience
        choice,
        voterPointsAtCast,
      });

      try {
        await newVote.save();
      } catch (saveError: any) {
        if (saveError.code === 11000) { // Duplicate key error (user already voted)
          return res.status(409).json({ error: 'You have already voted on this proposal.' });
        }
        console.error('Error saving vote:', saveError); // Log other save errors
        throw saveError; // Re-throw other save errors
      }

      // Recalculate proposal total weighted votes and check for broadcast
      const votesForProposal = await Vote.find({ proposalId: proposalObjectId });
      let totalWeightedScore = 0;
      votesForProposal.forEach(v => {
        if (v.choice === 'up') totalWeightedScore += v.voterPointsAtCast;
        // 'down' votes could optionally subtract points or be weighted differently, 
        // for now, only 'up' votes contribute positively to the broadcast threshold.
        // 'abstain' votes do not contribute to the score for broadcasting.
      });

      if (totalWeightedScore >= BROADCAST_THRESHOLD && !proposal.broadcasted) {
        proposal.broadcasted = true;
        await proposal.save();
        // Create platform-wide notifications so all users are aware of broadcasted proposal
        try {
          const allUsers = await Users.find({}, 'walletAddress').lean();

          const broadcastNotifications = allUsers
            .filter(u => u.walletAddress)
            .map(u => ({
              recipientWalletAddress: u.walletAddress as string,
              type: 'proposal_broadcasted' as const,
              title: `Proposal '${proposal.tokenName}' Broadcasted!`,
              message: `A proposal from squad ${proposal.squadName} has reached the broadcast threshold. Check it out and join the discussion!`,
              data: {
                proposalId: proposal._id.toString(),
                proposalName: proposal.tokenName,
                squadId: squad.squadId.toString(),
                squadName: squad.name,
              },
            }));

          if (broadcastNotifications.length > 0) {
            await Notification.insertMany(broadcastNotifications);
            console.log(`Broadcasted proposal notifications sent to ${broadcastNotifications.length} users.`);
          }
        } catch (notifError) {
          console.error('Error sending broadcast notifications:', notifError);
        }

        console.log(`Proposal ${proposalId} reached broadcast threshold and has been marked for broadcast.`);
      }

      return res.status(201).json({ message: 'Vote cast successfully!', vote: newVote });

    } catch (error) {
      console.error('Error casting vote:', error);
      if (error instanceof Error && error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }
      // Avoid sending generic Mongoose or DB errors to client if not a validation error or already handled duplicate
      if ((error as any).code === 11000) { // Should be caught above, but as a safeguard
         return res.status(409).json({ error: 'You have already voted on this proposal.' });
      }
      return res.status(500).json({ error: 'Failed to cast vote. An unexpected error occurred.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 