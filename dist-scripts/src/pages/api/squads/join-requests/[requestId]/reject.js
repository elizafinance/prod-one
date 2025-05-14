import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase } from '@/lib/mongodb';
import { createNotification } from '@/lib/notificationUtils';
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user || !session.user.walletAddress) {
        return res.status(401).json({ error: 'User not authenticated' });
    }
    const { requestId } = req.query;
    if (!requestId || typeof requestId !== 'string') {
        return res.status(400).json({ error: 'Request ID is required' });
    }
    const leaderWalletAddress = session.user.walletAddress;
    try {
        const { db } = await connectToDatabase();
        const squadJoinRequestsCollection = db.collection('squadjoinrequests');
        const squadsCollection = db.collection('squads');
        // 1. Find the join request
        const joinRequest = await squadJoinRequestsCollection.findOne({ requestId: requestId });
        if (!joinRequest) {
            return res.status(404).json({ error: 'Join request not found' });
        }
        if (joinRequest.status !== 'pending') {
            return res.status(400).json({ error: 'This request has already been processed.' });
        }
        // 2. Verify the current user is the leader of the squad associated with the request
        const squad = await squadsCollection.findOne({ squadId: joinRequest.squadId });
        if (!squad) {
            // This case should be rare if request integrity is maintained
            return res.status(404).json({ error: 'Squad not found for this request. Cannot verify leader.' });
        }
        if (squad.leaderWalletAddress !== leaderWalletAddress) {
            return res.status(403).json({ error: 'Only the squad leader can reject requests.' });
        }
        // 3. Update Request: mark as rejected
        const updateResult = await squadJoinRequestsCollection.updateOne({ requestId: requestId }, { $set: { status: 'rejected', updatedAt: new Date() } });
        if (updateResult.modifiedCount === 0) {
            // Should not happen if status was pending and requestId is correct
            return res.status(500).json({ error: 'Failed to update request status. It might have been processed by another action.' });
        }
        // 4. Send notification to requester
        await createNotification(db, joinRequest.requestingUserWalletAddress, 'squad_join_request_rejected', `Your request to join squad "${joinRequest.squadName}" was rejected.`, joinRequest.squadId, joinRequest.squadName, leaderWalletAddress, session.user.xUsername || undefined);
        return res.status(200).json({ message: 'Join request rejected successfully' });
    }
    catch (error) {
        console.error("Error rejecting squad join request:", error);
        return res.status(500).json({ error: 'Failed to reject squad join request' });
    }
}
