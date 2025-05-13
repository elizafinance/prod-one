import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Corrected path
import { connectToDatabase, SquadDocument, UserDocument } from '@/lib/mongodb'; // Adjust path
import { Proposal, IProposal } from '@/models/Proposal'; // Adjust path
import { Types } from 'mongoose';

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
  const session = await getServerSession(req, res, authOptions);
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

      if (squad.totalSquadPoints < REQUIRED_SQUAD_POINTS_FOR_PROPOSAL) {
        return res.status(403).json({ error: `Squad must have at least ${REQUIRED_SQUAD_POINTS_FOR_PROPOSAL.toLocaleString()} points to create a proposal.` });
      }
      
      const leaderUser = await usersCollection.findOne({ walletAddress: leaderWalletAddress });
      if (!leaderUser || !leaderUser._id) {
        return res.status(404).json({ error: 'Leader user record not found.'});
      }

      // Check if a proposal already exists for this squad in the current epoch
      const { epochStart, epochEnd } = getCurrentEpoch();
      const existingProposalThisEpoch = await Proposal.findOne({
        squadId: squad._id, // Assuming squad._id is the ObjectId reference
        epochStart: { $gte: epochStart, $lt: epochEnd }
      });

      if (existingProposalThisEpoch) {
        return res.status(409).json({ error: 'A proposal for this squad already exists in the current epoch.' });
      }

      const newProposal = new Proposal({
        squadId: squad._id, // Use squad's ObjectId for ref
        squadName: squad.name,
        createdByUserId: leaderUser._id, // Use leader's ObjectId for ref
        tokenContractAddress,
        tokenName,
        reason,
        epochStart,
        epochEnd,
        status: 'active',
        broadcasted: false, // Default
      });

      await newProposal.save();

      // TODO: Enqueue notification job for squad members (Step A.4)

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