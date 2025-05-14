import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user || !session.user.walletAddress) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    const userWalletAddress = session.user.walletAddress;
    try {
        const { db } = await connectToDatabase();
        const squadJoinRequestsCollection = db.collection('squadjoinrequests');
        const pendingRequests = await squadJoinRequestsCollection
            .find({
            requestingUserWalletAddress: userWalletAddress,
            status: 'pending',
        })
            .project({ squadId: 1, status: 1, requestId: 1, squadName: 1 })
            .toArray();
        return res.status(200).json({ requests: pendingRequests });
    }
    catch (error) {
        console.error("Error fetching user's pending squad join requests:", error);
        return res.status(500).json({ error: 'Failed to fetch pending join requests' });
    }
}
