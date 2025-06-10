import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Corrected path
import { connectToDatabase, SquadDocument, UserDocument } from '@/lib/mongodb'; // Adjust path
import { Proposal, IProposal } from '@/models/Proposal'; // Adjust path
import { Types } from 'mongoose';
import { ensureMongooseConnected } from '@/lib/mongooseConnect';
import { createNotification } from '@/lib/notificationUtils';

// Helper function to determine current epoch (Friday to Friday UTC)
function getCurrentEpoch() {
  const now = new Date();
  const currentDay = now.getUTCDay(); // Sunday = 0, Friday = 5
  const daysUntilFriday = (5 - currentDay + 7) % 7;
  
  const epochStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilFriday);
  epochStart.setUTCHours(0, 0, 0, 0);

  if (epochStart > now) { // If today is past Friday, current epoch started last Friday
    epochStart.setUTCDate(epochStart.getUTCDate() - 7);
  }
  
  const epochEnd = new Date(epochStart);
  epochEnd.setUTCDate(epochStart.getUTCDate() + 7); // Ends next Friday (exclusive, but stored as start of next Friday)

  return { epochStart, epochEnd };
}


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    await ensureMongooseConnected();
  } catch (err) {
    console.error('Failed to establish Mongoose connection in proposals API route:', err);
    return res.status(500).json({ error: 'Database connection error.' });
  }
  const session = await getServerSession(req, res, authOptions) as any;
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return res.status(401).json({ error: 'User not authenticated or wallet not available in session' });
  }
  const leaderWalletAddress = session.user.walletAddress;
  const { squadId } = req.query;

  // Define required points from environment variable or use default
  const REQUIRED_SQUAD_POINTS_FOR_PROPOSAL = parseInt(process.env.NEXT_PUBLIC_SQUAD_POINTS_TO_CREATE_PROPOSAL || "10000", 10);

  if (req.method === 'POST') {
    if (typeof squadId !== 'string') {
      return res.status(400).json({ error: 'Squad ID is required.' });
    }

    const { tokenContractAddress, tokenName, reason } = req.body;

    if (!tokenContractAddress || typeof tokenContractAddress !== 'string') {
      return res.status(400).json({ error: 'Token contract address is required.' });
    }
    if (!tokenName || typeof tokenName !== 'string' || tokenName.length > 50) {
      return res.status(400).json({ error: 'Token name is required and must be 50 characters or less.' });
    }
    if (!reason || typeof reason !== 'string' || reason.length > 140) {
      return res.status(400).json({ error: 'Reason is required and must be 140 characters or less.' });
    }

    try {
      const { db } = await connectToDatabase();
      const squadsCollection = db.collection<SquadDocument>('squads');
      const usersCollection = db.collection<UserDocument>('users'); // For createdByUserId

      const squad = await squadsCollection.findOne({ squadId });
      if (!squad) {
        return res.status(404).json({ error: 'Squad not found.' });
      }

      if (squad.leaderWalletAddress !== leaderWalletAddress) {
        return res.status(403).json({ error: 'Only the squad leader can create proposals.' });
      }

      // Dynamically calculate squad points by summing member points
      let squadTotalPoints = 0;
      if (squad.memberWalletAddresses && squad.memberWalletAddresses.length > 0) {
        const memberUsers = await usersCollection.find(
          { walletAddress: { $in: squad.memberWalletAddresses } },
          { projection: { points: 1 } }
        ).toArray();
        squadTotalPoints = memberUsers.reduce((sum, u) => sum + (u.points || 0), 0);
      }

      if (squadTotalPoints < REQUIRED_SQUAD_POINTS_FOR_PROPOSAL) {
        return res.status(403).json({ error: `Squad must have at least ${REQUIRED_SQUAD_POINTS_FOR_PROPOSAL.toLocaleString()} points to create a proposal.` });
      }
      
      const leaderUser = await usersCollection.findOne({ walletAddress: leaderWalletAddress });
      if (!leaderUser || !leaderUser._id) {
        return res.status(404).json({ error: 'Leader user record not found.'});
      }

      // Check if a proposal already exists for this squad in the current epoch
      const { epochStart, epochEnd } = getCurrentEpoch();
      const squadObjectId = squad._id ? new Types.ObjectId(squad._id) : undefined;
      if (!squadObjectId) {
        console.error('Squad document from native driver is missing _id.');
        return res.status(500).json({ error: 'Internal server error: Squad ID missing.'});
      }

      const existingProposalThisEpoch = await Proposal.findOne({
        squadId: squadObjectId, 
        epochStart: { $gte: epochStart, $lt: epochEnd }
      });

      if (existingProposalThisEpoch) {
        return res.status(409).json({ error: 'A proposal for this squad already exists in the current epoch.' });
      }

      const newProposal = new Proposal({
        squadId: squadObjectId,
        squadName: squad.name,
        createdByUserId: new Types.ObjectId(leaderUser._id), 
        tokenContractAddress,
        tokenName,
        reason,
        epochStart,
        epochEnd,
        status: 'active',
        broadcasted: false,
      });

      await newProposal.save();

      // Create notifications for squad members using the standardized utility
      if (squad.memberWalletAddresses && squad.memberWalletAddresses.length > 0) {
        const ctaUrl = newProposal.squadId && newProposal._id ? `/squads/${squad.squadId.toString()}/proposals/${newProposal._id.toString()}` : '/proposals';
        const leaderUsername = leaderUser.xUsername; // Assumes leaderUser has xUsername populated

        for (const memberWalletAddress of squad.memberWalletAddresses) {
          // Avoid notifying the leader about their own proposal creation if they are also a listed member for notifications
          // However, proposal_created is typically for all members to be aware.
          // If leader should NOT get this specific one, add: if (memberWalletAddress === leaderWalletAddress) continue;
          
          await createNotification(
            db, 
            memberWalletAddress, 
            'proposal_created',
            `New Proposal: ${newProposal.tokenName}`,
            `A new proposal "${newProposal.tokenName}" has been created in your squad, ${squad.name}, by @${leaderUsername || leaderWalletAddress.substring(0,6)}. Voting is open! `,
            ctaUrl,
            newProposal._id.toString(),   // relatedQuestId (using for proposalId)
            newProposal.tokenName,        // relatedQuestTitle (using for proposalName)
            squad.squadId,                // relatedSquadId (string ID from squad doc)
            squad.name,                   // relatedSquadName
            leaderWalletAddress,          // relatedUserId (creator of the proposal)
            leaderUsername                // relatedUserName (creator's username)
            // No relatedInvitationId, rewardAmount, rewardCurrency, badgeId
          );
        }
        console.log(`Sent ${squad.memberWalletAddresses.length} 'proposal_created' notifications for proposal ${newProposal._id} in squad ${squad.name}.`);
      }

      return res.status(201).json({ message: 'Proposal created successfully!', proposal: newProposal });

    } catch (error) {
      console.error('Error creating proposal:', error);
      if (error instanceof Error && error.name === 'ValidationError') {
        return res.status(400).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to create proposal.' });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 