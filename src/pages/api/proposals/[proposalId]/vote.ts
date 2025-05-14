import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
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
  let voterUserId: Types.ObjectId | null = null;
  try {
    // Try to convert the session dbId to an ObjectId if it exists
    if (session.user.dbId && Types.ObjectId.isValid(session.user.dbId)) {
      voterUserId = new Types.ObjectId(session.user.dbId);
    }
  } catch (err) {
    console.warn('[VoteAPI] Invalid session.user.dbId:', session.user.dbId);
    // Continue without valid ID - we'll try wallet lookup as fallback
  }

  const { proposalId } = req.query;

  if (req.method === 'POST') {
    if (typeof proposalId !== 'string' || !Types.ObjectId.isValid(proposalId)) {
      return res.status(400).json({ error: 'Valid Proposal ID is required.' });
    }

    const { choice } = req.body;
    if (!choice || !['up', 'down', 'abstain'].includes(choice)) {
      return res.status(400).json({ error: 'Invalid vote choice. Must be one of: up, down, abstain.' });
    }

    // --- Wallet signature verification ---
    const sigB58 = req.headers['x-wallet-sig'] as string | undefined;
    const msg = req.headers['x-wallet-msg'] as string | undefined;

    if (!sigB58 || !msg) {
      return res.status(400).json({ error: 'Missing wallet signature.' });
    }

    try {
      const sig = bs58.decode(sigB58);
      const pubkey = new PublicKey(voterWalletAddress);
      const verified = nacl.sign.detached.verify(Buffer.from(msg, 'utf8'), sig, pubkey.toBytes());
      if (!verified) {
        return res.status(401).json({ error: 'Invalid wallet signature.' });
      }

      // Ensure message content matches expected format and data
      const parts = msg.split('|'); // defai-vote|<proposalId>|<choice>|<timestamp>
      if (parts.length !== 4 || parts[0] !== 'defai-vote' || parts[1] !== proposalId || parts[2] !== choice) {
        return res.status(400).json({ error: 'Signed message content mismatch.' });
      }

      const msgTimestamp = parseInt(parts[3], 10);
      const nowTs = Date.now();
      if (isNaN(msgTimestamp) || Math.abs(nowTs - msgTimestamp) > 5 * 60 * 1000) { // 5-minute window
        return res.status(400).json({ error: 'Signed message expired. Please sign again.' });
      }
    } catch (sigErr) {
      console.error('[VoteAPI] Signature verification error:', sigErr);
      return res.status(400).json({ error: 'Signature verification failed.' });
    }

    try {
      // Try to find voter by either ID or wallet address
      let voter = null;
      
      // First attempt: lookup by ID if we have a valid one
      if (voterUserId) {
        console.log('[VoteAPI] Looking up voter by ID:', voterUserId.toString());
        voter = await User.findById(voterUserId).lean<IUser>();
      }
      
      // Second attempt: fallback to wallet address lookup
      if (!voter) {
        console.log('[VoteAPI] Looking up voter by wallet address:', voterWalletAddress);
        voter = await User.findOne({ walletAddress: voterWalletAddress }).lean<IUser>();
      }
      
      // If we can't find the user, create a minimal record for them
      if (!voter) {
        console.warn('[VoteAPI] Voter not found, creating minimal profile:', {
          voterUserId: voterUserId?.toString() || 'none',
          voterWalletAddress,
        });
        
        try {
          // Create minimal user record
          const newUser = new User({
            walletAddress: voterWalletAddress,
            xUserId: session.user.xId || `x-${Date.now()}`, // Fallback if no xId
            xUsername: session.user.name,
            points: 500, // Default starting points
          });
          
          await newUser.save();
          console.log('[VoteAPI] Created new user profile for:', voterWalletAddress);
          
          voter = newUser.toObject();
        } catch (createErr) {
          console.error('[VoteAPI] Failed to create user profile:', createErr);
          return res.status(500).json({ 
            error: 'Could not create user profile. Please try again later.'
          });
        }
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
      } catch (error: any) {
        // Central catch – capture anything that slipped through earlier guards
        console.error('[VoteAPI] Unhandled error casting vote for proposal', proposalId, 'by', voterWalletAddress, '\nError:', error);

        if (error instanceof Error && error.name === 'ValidationError') {
          return res.status(400).json({ error: error.message });
        }

        if (error?.code === 11000) { // Duplicate vote safeguard (should be handled earlier)
          return res.status(409).json({ error: 'You have already voted on this proposal.' });
        }

        const safeMessage = (error && error.message) ? error.message : 'Failed to cast vote.';
        return res.status(500).json({ error: safeMessage });
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
          const allUsers = await User.find({}, 'walletAddress').lean();

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

    } catch (error: any) {
      console.error('[VoteAPI] Outer error casting vote:', error);
      if (error instanceof Error && error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }
      if (error?.code === 11000) {
        return res.status(409).json({ error: 'You have already voted on this proposal.' });
      }
      const safeMessage = (error && error.message) ? error.message : 'Failed to cast vote.';
      return res.status(500).json({ error: safeMessage });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 