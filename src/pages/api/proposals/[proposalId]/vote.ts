import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { type Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { User, IUser } from '@/models/User';
import { ensureMongooseConnected } from '@/lib/mongooseConnect';
import { Proposal, IProposal } from '@/models/Proposal';
import { Vote, IVote } from '@/models/Vote';
import { Squad, ISquad } from '@/models/Squad';
import { Notification } from '@/models/Notification';
import { Types } from 'mongoose';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';

// Placeholder types, define them properly if you have a specific structure
type VoteResponse = any; 
interface ApiResponse<T> { 
  error?: string; 
  message?: string; 
  vote?: T; 
  alreadyEarned?: boolean; 
  badgeId?: string; 
  pointsAwarded?: number; 
}

const MIN_POINTS_TO_VOTE = parseInt(process.env.NEXT_PUBLIC_MIN_POINTS_TO_VOTE || "500", 10);
const BROADCAST_THRESHOLD = parseInt(process.env.NEXT_PUBLIC_PROPOSAL_BROADCAST_THRESHOLD || "1000", 10);

// Temporarily removing withAuth to isolate other errors if withAuth is problematic
// export default withAuth(async function handler(
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<VoteResponse | string>>
  // session: Session // This would be provided by withAuth
) {
  // Manually get session if withAuth is removed for testing
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || !session.user.dbId || !session.user.walletAddress ) {
    return res.status(401).json({ error: 'User not authenticated or session data incomplete.' });
  }

  try {
    await ensureMongooseConnected();
  } catch (err) {
    console.error('Failed to establish Mongoose connection in vote API route:', err);
    return res.status(500).json({ error: 'Database connection error.' });
  }

  const { proposalId } = req.query;
  const { choice } = req.body;
  const userId = session.user.dbId; // Now from manually fetched session
  const userWalletAddress = session.user.walletAddress; // Now from manually fetched session

  if (req.method === 'POST') {
    if (typeof proposalId !== 'string' || proposalId.trim() === '') {
      return res.status(400).json({ error: 'Proposal identifier is required.' });
    }

    if (!choice || !['up', 'down', 'abstain'].includes(choice)) {
      return res.status(400).json({ error: 'Invalid vote choice. Must be one of: up, down, abstain.' });
    }

    if (process.env.NODE_ENV !== 'test') {
      const sigB58 = req.headers['x-wallet-sig'] as string | undefined;
      const msg = req.headers['x-wallet-msg'] as string | undefined;
      if (!sigB58 || !msg) {
        return res.status(400).json({ error: 'Missing signature or message for verification.' });
      }
      try {
        const messageBytes = new TextEncoder().encode(msg);
        const signatureBytes = bs58.decode(sigB58);
        const publicKeyBytes = bs58.decode(userWalletAddress!);
        if (!nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)) {
          return res.status(401).json({ error: 'Invalid signature.' });
        }
        const parsedMsg = JSON.parse(msg);
        if (parsedMsg.proposalId !== proposalId || parsedMsg.choice !== choice || parsedMsg.voter !== userWalletAddress) {
          return res.status(400).json({ error: 'Signed message content does not match vote details.'});
        }
      } catch (sigErr) {
        console.error('[VoteAPI] Signature verification error:', sigErr);
        return res.status(400).json({ error: 'Signature verification failed.' });
      }
    }

    try {
      let voter = null;
      if (userId) {
        voter = await User.findById(userId).lean<IUser>();
      }
      if (!voter) {
        voter = await User.findOne({ walletAddress: userWalletAddress }).lean<IUser>();
      }
      if (!voter) {
        console.warn('[VoteAPI] Voter not found, creating minimal profile:', {
          voterUserId: userId?.toString() || 'none',
          userWalletAddress, // Corrected here
        });
        try {
          const newUser = new User({
            walletAddress: userWalletAddress, // Corrected here
            xUserId: session.user.xId || `x-${Date.now()}`,
            xUsername: session.user.name,
            points: 500,
          });
          await newUser.save();
          voter = newUser.toObject();
        } catch (createErr) {
          return res.status(500).json({ error: 'Could not create user profile. Please try again later.'});
        }
      }
      if ((voter.points || 0) < MIN_POINTS_TO_VOTE) {
        return res.status(403).json({ error: `You need at least ${MIN_POINTS_TO_VOTE} points to vote.` });
      }
      let proposalObjectId: Types.ObjectId | null = null;
      let proposal = null;

      if (Types.ObjectId.isValid(proposalId)) {
        proposalObjectId = new Types.ObjectId(proposalId);
        proposal = await Proposal.findById(proposalObjectId);
      }

      if (!proposal) {
        proposal = await Proposal.findOne({ slug: proposalId });
        if (proposal) proposalObjectId = proposal._id as unknown as Types.ObjectId;
      }

      if (!proposal) { return res.status(404).json({ error: 'Proposal not found.' }); }
      if (proposal.status !== 'active') { return res.status(403).json({ error: 'Voting is only allowed on active proposals.' });}
      const now = new Date();
      if (now >= proposal.epochEnd) { return res.status(403).json({ error: 'The voting period for this proposal has ended.' }); }
      let squad = null; try { squad = await Squad.findById(proposal.squadId).lean<ISquad>(); if (!squad) { squad = await Squad.findOne({ squadId: proposal.squadId.toString() }).lean<ISquad>(); } } catch (squadErr) { console.error(`[VoteAPI] Error finding squad for proposal:`, squadErr); }
      if (!squad) { console.warn(`[VoteAPI] Allowing vote without squad verification for wallet: ${userWalletAddress}`); } else if (!squad.memberWalletAddresses.includes(userWalletAddress)) { return res.status(403).json({ error: 'You must be a member of the squad to vote on this proposal.' });}
      const voterPointsAtCast = voter.points || 0;
      const newVote = new Vote({ proposalId: proposalObjectId, voterUserId: userId, voterWallet: userWalletAddress, squadId: proposal.squadId, choice, voterPointsAtCast, });
      try { await newVote.save(); } catch (error: any) { if (error?.code === 11000) { return res.status(409).json({ error: 'You have already voted on this proposal.' }); } throw error; /* Re-throw other save errors */ }
      const votesForProposal = await Vote.find({ proposalId: proposalObjectId });
      let totalWeightedScore = 0; votesForProposal.forEach(v => { if (v.choice === 'up') totalWeightedScore += v.voterPointsAtCast; });
      if (totalWeightedScore >= BROADCAST_THRESHOLD && !proposal.broadcasted) { proposal.broadcasted = true; await proposal.save(); /* ... create broadcast notifications ... */ console.log(`Proposal ${proposalId} reached broadcast threshold.`); }
      return res.status(201).json({ message: 'Vote cast successfully!', vote: newVote as any });

    } catch (error: any) {
        console.error('[VoteAPI] Outer error casting vote:', error);
        if (error instanceof Error && error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        if (error?.code === 11000) { // This duplicate check might be redundant if newVote.save() throws it
            return res.status(409).json({ error: 'You have already voted on this proposal.' });
        }
        const safeMessage = (error && error.message) ? error.message : 'Failed to cast vote.';
        return res.status(500).json({ error: safeMessage });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
// }); // Closing parenthesis for withAuth if it's used
}

export default handler; // Exporting directly if withAuth is not used for now 