import type { NextApiRequest, NextApiResponse } from 'next';
import { connectToDatabase } from '@/lib/mongodb';

interface TotalPointsResponse {
  totalCommunityPoints?: number;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TotalPointsResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // If DB credentials are missing in development, gracefully return 0 instead of 500.
    if (!process.env.MONGODB_URI || !process.env.MONGODB_DB_NAME) {
      console.warn('[total-points] MongoDB env vars are missing – returning 0 for dev.');
      return res.status(200).json({ totalCommunityPoints: 0 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    const aggregationResult = await usersCollection.aggregate([
      {
        $group: {
          _id: null, // Group all documents into a single group
          totalCommunityPoints: { $sum: '$points' } // Sum the 'points' field
        }
      }
    ]).toArray();

    let totalCommunityPoints = 0;
    if (aggregationResult.length > 0 && aggregationResult[0].totalCommunityPoints) {
      totalCommunityPoints = aggregationResult[0].totalCommunityPoints;
    }

    return res.status(200).json({ totalCommunityPoints });
  } catch (error: any) {
    console.error("Error fetching total community points:", error);
    // In dev, respond with 0 instead of 500 to keep UI functional
    if (process.env.NODE_ENV !== 'production') {
      return res.status(200).json({ totalCommunityPoints: 0 });
    }
    return res.status(500).json({ error: 'Failed to fetch total community points: ' + error.message });
  }
} 