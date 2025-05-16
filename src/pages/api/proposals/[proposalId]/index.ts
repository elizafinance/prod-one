import { NextApiRequest, NextApiResponse } from 'next';
import { ensureMongooseConnected } from '@/lib/mongooseConnect';
import { Proposal, IProposal } from '@/models/Proposal';
import { Vote, IVote } from '@/models/Vote';
import { Types } from 'mongoose';

// Define a plain interface for lean vote objects
interface LeanVote {
  _id?: Types.ObjectId; // Optional because .lean() might not include it unless selected
  proposalId: Types.ObjectId;
  voterUserId: Types.ObjectId;
  voterWallet: string;
  squadId: Types.ObjectId; 
  choice: 'up' | 'down' | 'abstain';
  voterPointsAtCast: number;
  createdAt?: Date; // Keep if needed for display, otherwise can remove from lean select
}

// Updated interface for the proposal data including detailed vote tallies
interface ProposalWithDetailedTally extends IProposal {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { proposalId } = req.query;

  if (req.method === 'GET') {
    if (typeof proposalId !== 'string' || proposalId.trim() === '') {
      return res.status(400).json({ error: 'Proposal identifier is required.' });
    }

    try {
      await ensureMongooseConnected();

      let proposal: IProposal | null = null;
      let proposalObjectId: Types.ObjectId | null = null;

      if (Types.ObjectId.isValid(proposalId)) {
        proposalObjectId = new Types.ObjectId(proposalId);
        proposal = await Proposal.findById(proposalObjectId).lean() as IProposal | null;
      }

      // If not found by ObjectId, try lookup by slug/hash string
      if (!proposal) {
        proposal = await Proposal.findOne({ slug: proposalId }).lean() as IProposal | null;
        if (proposal) {
          proposalObjectId = proposal._id as unknown as Types.ObjectId;
        }
      }

      if (!proposal) {
        return res.status(404).json({ error: 'Proposal not found.' });
      }

      // If the proposal is active, calculate live tallies.
      // If closed, use the stored final tallies.
      let responseData: ProposalWithDetailedTally;

      if (proposal.status === 'active') {
        const votes = await Vote.find({ proposalId: proposalObjectId }, 'choice voterPointsAtCast').lean() as unknown as Pick<LeanVote, 'choice' | 'voterPointsAtCast'>[];
        
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

        responseData = {
          ...(proposal as any), 
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
        };
      } else { // For 'closed_xxx' or 'archived' statuses, use stored final tallies
        responseData = {
          ...(proposal as any),
          tally: {
            upVotesCount: proposal.finalUpVotesCount || 0,
            downVotesCount: proposal.finalDownVotesCount || 0,
            abstainVotesCount: proposal.finalAbstainVotesCount || 0,
            upVotesWeight: proposal.finalUpVotesWeight || 0,
            downVotesWeight: proposal.finalDownVotesWeight || 0,
            netVoteWeight: (proposal.finalUpVotesWeight || 0) - (proposal.finalDownVotesWeight || 0),
            totalEngagedWeight: (proposal.finalUpVotesWeight || 0) + (proposal.finalDownVotesWeight || 0),
          },
          totalVoters: proposal.totalFinalVoters || 0,
        };
      }

      return res.status(200).json(responseData);

    } catch (error) {
      console.error(`Error fetching proposal ${proposalId}:`, error);
      return res.status(500).json({ error: 'Failed to fetch proposal details.' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 