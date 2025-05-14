import { NextApiRequest, NextApiResponse } from 'next';
import { Proposal } from '@/models/Proposal';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const PROPOSALS_PER_PAGE = parseInt(process.env.NEXT_PUBLIC_PROPOSALS_PER_PAGE || '10', 10);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || PROPOSALS_PER_PAGE;
    const skip = (page - 1) * limit;

    // Closed, executed, failed, passed, archived (but not active)
    const statusFilter = {
      status: { $in: ['closed_passed', 'closed_failed', 'closed_executed', 'archived'] },
    };

    const totalProposalsCount = await Proposal.countDocuments(statusFilter);

    const proposals = await Proposal.find(statusFilter)
      .sort({ epochEnd: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      proposals,
      currentPage: page,
      totalPages: Math.ceil(totalProposalsCount / limit),
      totalProposals: totalProposalsCount,
    });
  } catch (error) {
    console.error('Error fetching closed proposals:', error);
    return res.status(500).json({ error: 'Failed to fetch closed proposals.' });
  }
} 