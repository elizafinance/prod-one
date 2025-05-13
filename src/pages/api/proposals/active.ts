import { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/mongodb';
import { Proposal, IProposal } from '@/models/Proposal';
import { Vote, IVote } from '@/models/Vote'; 
import { Types } from 'mongoose';

// Define a plain interface for lean proposal objects
interface LeanProposal {
  _id: Types.ObjectId;
  squadId: Types.ObjectId;
  squadName: string;
  createdByUserId: Types.ObjectId;
  tokenContractAddress: string;
  tokenName: string;
  reason: string;
  createdAt: Date;
  epochStart: Date;
  epochEnd: Date;
  broadcasted: boolean;
  status: 'active' | 'archived';
  // Add any other fields that are selected by .lean()
}

// Define an interface for the proposal data including vote tallies
interface ProposalWithTally extends LeanProposal { // Extend LeanProposal
  tally: {
    up: number;
    down: number;
    abstain: number;
    totalWeight: number; 
  };
  totalVoters: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      await connectToDatabase(); 

      const PROPOSALS_PER_PAGE = parseInt(process.env.NEXT_PUBLIC_PROPOSALS_PER_PAGE || "10", 10);

      const now = new Date();
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || PROPOSALS_PER_PAGE;
      const skip = (page - 1) * limit;

      const activeProposals = await Proposal.find({
        status: 'active',
      })
      .sort({ createdAt: -1 }) 
      .skip(skip)
      .limit(limit)
      .lean() as unknown as LeanProposal[];

      const proposalsWithTallies: ProposalWithTally[] = [];

      for (const proposal of activeProposals) {
        // Ensure proposal._id is a Types.ObjectId for the query if it isn't already
        const proposalObjectId = proposal._id instanceof Types.ObjectId ? proposal._id : new Types.ObjectId(proposal._id);
        const votes = await Vote.find({ proposalId: proposalObjectId }).lean();
        
        let upVotes = 0;
        let downVotes = 0;
        let abstainVotes = 0;
        let totalWeightedScore = 0;

        votes.forEach(vote => {
          if (vote.choice === 'up') {
            upVotes++;
            totalWeightedScore += vote.voterPointsAtCast;
          } else if (vote.choice === 'down') {
            downVotes++;
            totalWeightedScore += vote.voterPointsAtCast; 
          } else if (vote.choice === 'abstain') {
            abstainVotes++;
          }
        });
        
        proposalsWithTallies.push({
          ...proposal, // Spread the LeanProposal object
          tally: {
            up: upVotes,
            down: downVotes,
            abstain: abstainVotes,
            totalWeight: totalWeightedScore
          },
          totalVoters: votes.length,
        });
      }
      
      proposalsWithTallies.sort((a, b) => b.tally.totalWeight - a.tally.totalWeight);

      const totalProposalsCount = await Proposal.countDocuments({
        status: 'active',
      });

      return res.status(200).json({
        proposals: proposalsWithTallies,
        currentPage: page,
        totalPages: Math.ceil(totalProposalsCount / limit),
        totalProposals: totalProposalsCount,
      });

    } catch (error) {
      console.error('Error fetching active proposals:', error);
      return res.status(500).json({ error: 'Failed to fetch active proposals.' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 