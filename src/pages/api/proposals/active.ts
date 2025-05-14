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
  status: 'active' | 'archived' | 'closed_passed' | 'closed_failed' | 'closed_executed'; // Expanded status
  finalUpVotesWeight?: number;
  finalDownVotesWeight?: number;
  finalAbstainVotesCount?: number;
  totalFinalVoters?: number;
  // Add any other fields that are selected by .lean()
}

// Updated interface for the proposal data including detailed vote tallies
interface ProposalWithDetailedTally extends LeanProposal {
  tally: {
    upVotesCount: number;
    downVotesCount: number;
    abstainVotesCount: number;
    upVotesWeight: number;
    downVotesWeight: number;
    netVoteWeight: number;
    totalEngagedWeight: number;
  };
  totalVoters: number;
}

// Define a lean interface for vote objects if not already universally available
interface LeanVote {
  _id?: Types.ObjectId;
  proposalId: Types.ObjectId;
  voterUserId: Types.ObjectId;
  voterWallet: string;
  squadId: Types.ObjectId; 
  choice: 'up' | 'down' | 'abstain';
  voterPointsAtCast: number;
  createdAt?: Date;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      await connectToDatabase(); 

      const PROPOSALS_PER_PAGE = parseInt(process.env.NEXT_PUBLIC_PROPOSALS_PER_PAGE || "10", 10);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || PROPOSALS_PER_PAGE;
      const skip = (page - 1) * limit;

      const activeProposals = await Proposal.find({
        status: 'active', // Only fetch active proposals for this live tallying endpoint
      })
      .sort({ createdAt: -1 }) 
      .skip(skip)
      .limit(limit)
      .lean() as unknown as LeanProposal[]; // Use unknown for lean() safety

      const proposalsWithTallies: ProposalWithDetailedTally[] = [];

      for (const proposal of activeProposals) {
        const proposalObjectId = proposal._id instanceof Types.ObjectId ? proposal._id : new Types.ObjectId(proposal._id);
        const votes = await Vote.find({ proposalId: proposalObjectId }).lean() as unknown as LeanVote[];
        
        let upVotesCount = 0;
        let downVotesCount = 0;
        let abstainVotesCount = 0;
        let upVotesWeight = 0;
        let downVotesWeight = 0;

        votes.forEach(vote => {
          if (vote.choice === 'up') {
            upVotesCount++;
            upVotesWeight += vote.voterPointsAtCast;
          } else if (vote.choice === 'down') {
            downVotesCount++;
            downVotesWeight += vote.voterPointsAtCast; 
          } else if (vote.choice === 'abstain') {
            abstainVotesCount++;
          }
        });
        
        const netVoteWeight = upVotesWeight - downVotesWeight;
        const totalEngagedWeight = upVotesWeight + downVotesWeight;

        proposalsWithTallies.push({
          ...proposal,
          tally: {
            upVotesCount,
            downVotesCount,
            abstainVotesCount,
            upVotesWeight,
            downVotesWeight,
            netVoteWeight,
            totalEngagedWeight,
          },
          totalVoters: votes.length,
        });
      }
      
      // Sort by netVoteWeight (strongest positive first) or totalEngagedWeight as a secondary sort maybe
      proposalsWithTallies.sort((a, b) => b.tally.netVoteWeight - a.tally.netVoteWeight);

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