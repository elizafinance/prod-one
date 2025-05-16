import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

const PASS_NET_WEIGHT_TARGET = parseInt(process.env.NEXT_PUBLIC_PROPOSAL_PASS_NET_WEIGHT_TARGET || '1000', 10);

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db();

    // Fetch the newest ACTIVE proposal (fallback to newest overall)
    let proposalDoc = await db.collection('proposals')
      .find({ status: 'active' })
      .sort({ createdAt: -1 })
      .limit(1)
      .next();

    if (!proposalDoc) {
      proposalDoc = await db.collection('proposals')
        .find()
        .sort({ createdAt: -1 })
        .limit(1)
        .next();
    }

    if (!proposalDoc) {
      return NextResponse.json({ error: 'No proposals found' }, { status: 404 });
    }

    // Aggregate votes to build a quick tally
    const votesAgg = await db.collection('votes').aggregate([
      { $match: { proposalId: proposalDoc._id } },
      {
        $group: {
          _id: '$choice',
          totalWeight: { $sum: '$voterPointsAtCast' },
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    let upVotesWeight = 0;
    let downVotesWeight = 0;
    let abstainVotesCount = 0;
    let upVotesCount = 0;
    let downVotesCount = 0;

    votesAgg.forEach((row) => {
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
    return NextResponse.json({ error: 'Failed to fetch top proposal' }, { status: 500 });
  }
} 