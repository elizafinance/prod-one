import { NextResponse } from 'next/server';
import { ensureMongooseConnected } from '@/lib/mongooseConnect';
import { Proposal } from '@/models/Proposal';
import { Vote } from '@/models/Vote';
import { Types } from 'mongoose';

const PASS_NET_WEIGHT_TARGET = parseInt(
  process.env.NEXT_PUBLIC_PROPOSAL_PASS_NET_WEIGHT_TARGET || '1000',
  10,
);

export async function GET() {
  try {
    // Ensure Mongoose (and therefore MongoDB) is connected. This keeps us consistent
    // with the rest of the codebase, which primarily uses Mongoose models.
    await ensureMongooseConnected();

    // Step 1: Find the most recent ACTIVE proposal. If none, grab the most recent overall.
    let proposalDoc: any = await Proposal.findOne({ status: 'active' })
      .sort({ createdAt: -1 })
      .lean();

    if (!proposalDoc) {
      proposalDoc = await Proposal.findOne().sort({ createdAt: -1 }).lean();
    }

    if (!proposalDoc) {
      return NextResponse.json({ error: 'No proposals found' }, { status: 404 });
    }

    const proposalId = new Types.ObjectId(proposalDoc._id);

    // Step 2: Aggregate votes to build a quick tally
    const votesAgg = await Vote.aggregate([
      { $match: { proposalId } },
      {
        $group: {
          _id: '$choice',
          totalWeight: { $sum: '$voterPointsAtCast' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Initialise counts/weights
    let upVotesWeight = 0;
    let downVotesWeight = 0;
    let abstainVotesCount = 0;
    let upVotesCount = 0;
    let downVotesCount = 0;

    votesAgg.forEach((row: any) => {
      if (row._id === 'up') {
        upVotesWeight = row.totalWeight;
        upVotesCount = row.count;
      } else if (row._id === 'down') {
        downVotesWeight = row.totalWeight;
        downVotesCount = row.count;
      } else if (row._id === 'abstain') {
        abstainVotesCount = row.count;
      }
    });

    const netVoteWeight = upVotesWeight - downVotesWeight;
    const totalEngagedWeight = upVotesWeight + downVotesWeight;

    const responseBody = {
      _id: proposalDoc._id.toString(),
      slug: proposalDoc.slug || null,
      tokenName: proposalDoc.tokenName,
      reason: proposalDoc.reason,
      createdAt: proposalDoc.createdAt,
      tally: {
        upVotesWeight,
        downVotesWeight,
        netVoteWeight,
        totalEngagedWeight,
        upVotesCount,
        downVotesCount,
        abstainVotesCount,
      },
      targetVotes: PASS_NET_WEIGHT_TARGET,
    };

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('Failed to fetch top proposal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top proposal' },
      { status: 500 },
    );
  }
} 