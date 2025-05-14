import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { Vote } from '@/models/Vote';
import { Types } from 'mongoose';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || !session.user.dbId) {
    return res.status(401).json({ error: 'User not authenticated or user ID missing from session.' });
  }
  const voterUserId = new Types.ObjectId(session.user.dbId);

  const { proposalId } = req.query;

  if (req.method === 'GET') {
    if (typeof proposalId !== 'string' || !Types.ObjectId.isValid(proposalId)) {
      return res.status(400).json({ error: 'Valid Proposal ID is required.' });
    }

    try {
      // Assuming Mongoose connection is handled globally or by models themselves
      // (e.g. if Mongoose.connect was called in an init script or by another API route)
      // If not, ensure mongoose.connect(process.env.MONGODB_URI!) is called.
      
      const proposalObjectId = new Types.ObjectId(proposalId);

      const userVote = await Vote.findOne(
        { proposalId: proposalObjectId, voterUserId: voterUserId }, 
        'choice createdAt' // Select only the choice and when it was cast
      ).lean();

      if (userVote) {
        return res.status(200).json({ vote: userVote });
      } else {
        // It's not an error if the user hasn't voted, so return 200 with null or a specific status like 204 No Content.
        // For client-side simplicity, returning 200 with a clear structure is often easier.
        return res.status(200).json({ vote: null }); 
      }

    } catch (error) {
      console.error(`Error fetching user's vote for proposal ${proposalId}:`, error);
      return res.status(500).json({ error: 'Failed to fetch user vote.' });
    }
  } else {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
} 