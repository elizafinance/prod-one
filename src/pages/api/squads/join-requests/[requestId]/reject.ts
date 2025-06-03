import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, ISquadJoinRequest, SquadDocument } from '@/lib/mongodb';
import { createNotification } from '@/lib/notificationUtils';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const session = await getServerSession(req, res, authOptions) as any;
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
    const squadJoinRequestsCollection = db.collection<ISquadJoinRequest>('squadjoinrequests');
    const squadsCollection = db.collection<SquadDocument>('squads');

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
    const updateResult = await squadJoinRequestsCollection.updateOne(
      { requestId: requestId }, 
      { $set: { status: 'rejected', updatedAt: new Date() } }
    );

    if (updateResult.modifiedCount === 0) {
        // Should not happen if status was pending and requestId is correct
        return res.status(500).json({ error: 'Failed to update request status. It might have been processed by another action.' });
    }

    // 4. Send notification to requester
    const notificationTitle = `Request Update: ${joinRequest.squadName}`;
    const notificationMessage = `Your request to join the squad "${joinRequest.squadName}" was rejected by the leader.`;
    // CTA could be to browse other squads or back to their dashboard
    const ctaUrl = `/squads/browse`; 

    await createNotification(
      db,
      joinRequest.requestingUserWalletAddress, // recipientWalletAddress
      'squad_join_request_rejected',           // type
      notificationTitle,                       // title
      notificationMessage,                     // message
      ctaUrl,                                  // ctaUrl
      undefined,                               // relatedQuestId
      undefined,                               // relatedQuestTitle
      joinRequest.squadId,                     // relatedSquadId
      joinRequest.squadName,                   // relatedSquadName
      leaderWalletAddress,                     // relatedUserId (the leader who rejected)
      session.user.xUsername || undefined,     // relatedUserName (leader's name)
      joinRequest.requestId                    // relatedInvitationId (using for join request ID)
    );

    return res.status(200).json({ message: 'Join request rejected successfully' });

  } catch (error) {
    console.error("Error rejecting squad join request:", error);
    return res.status(500).json({ error: 'Failed to reject squad join request' });
  }
} 