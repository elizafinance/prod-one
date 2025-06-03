import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, ISquadJoinRequest, SquadDocument } from '@/lib/mongodb';
import { createNotification } from '@/lib/notificationUtils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  const requestingWallet = session.user.walletAddress;

  try {
    const { db } = await connectToDatabase();
    const squadJoinRequestsCollection = db.collection<ISquadJoinRequest>('squadjoinrequests');
    const squadsCollection = db.collection<SquadDocument>('squads');

    // 1. Find the join request and ensure it belongs to current user
    const joinRequest = await squadJoinRequestsCollection.findOne({ requestId });
    if (!joinRequest) {
      return res.status(404).json({ error: 'Join request not found' });
    }
    if (joinRequest.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be cancelled.' });
    }
    if (joinRequest.requestingUserWalletAddress !== requestingWallet) {
      return res.status(403).json({ error: 'You can only cancel your own join requests.' });
    }

    // 2. Update status to cancelled
    await squadJoinRequestsCollection.updateOne(
      { requestId },
      { $set: { status: 'cancelled', updatedAt: new Date() } }
    );

    // 3. Notify squad leader
    const squad = await squadsCollection.findOne({ squadId: joinRequest.squadId });
    if (squad) {
      const notificationTitle = `Join Request Cancelled: ${squad.name}`;
      const notificationMessage = `${session.user.xUsername ? '@' + session.user.xUsername : requestingWallet.substring(0,6)} cancelled their pending request to join your squad, "${squad.name}".`;
      const ctaUrl = `/squads/${squad.squadId}/manage?tab=requests`; // Link to squad request management

      await createNotification(
        db,
        squad.leaderWalletAddress,            // recipientWalletAddress (squad leader)
        'squad_join_request_cancelled',     // type
        notificationTitle,                    // title
        notificationMessage,                  // message
        ctaUrl,                               // ctaUrl
        undefined,                            // relatedQuestId
        undefined,                            // relatedQuestTitle
        squad.squadId,                        // relatedSquadId
        squad.name,                           // relatedSquadName
        requestingWallet,                     // relatedUserId (the user who cancelled)
        session.user.xUsername || undefined,  // relatedUserName (name of the user who cancelled)
        joinRequest.requestId                 // relatedInvitationId (using for join request ID)
      );
    }

    return res.status(200).json({ message: 'Join request cancelled.' });
  } catch (error) {
    console.error('Error cancelling squad join request:', error);
    return res.status(500).json({ error: 'Failed to cancel join request' });
  }
} 