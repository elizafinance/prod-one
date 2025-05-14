import { connectToDatabase } from '@/lib/mongodb';
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
    try {
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
    }
    catch (error) {
        console.error("Error fetching total community points:", error);
        return res.status(500).json({ error: 'Failed to fetch total community points: ' + error.message });
    }
}
