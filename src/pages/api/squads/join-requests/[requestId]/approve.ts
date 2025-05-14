import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, UserDocument, SquadDocument, ISquadJoinRequest } from '@/lib/mongodb';
import { createNotification } from '@/lib/notificationUtils';

// Constant for max members, could be from env or config
const MAX_SQUAD_MEMBERS = parseInt(process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || '50', 10);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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
    const usersCollection = db.collection<UserDocument>('users');
    const squadsCollection = db.collection<SquadDocument>('squads');
    const squadJoinRequestsCollection = db.collection<ISquadJoinRequest>('squadjoinrequests');

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
      return res.status(404).json({ error: 'Squad not found for this request' });
    }
    if (squad.leaderWalletAddress !== leaderWalletAddress) {
      return res.status(403).json({ error: 'Only the squad leader can approve requests.' });
    }

    // 3. Check if squad is full
    const memberLimit = squad.maxMembers || MAX_SQUAD_MEMBERS;
    if (squad.memberWalletAddresses.length >= memberLimit) {
      // Optionally, reject the request automatically or just inform leader
      await squadJoinRequestsCollection.updateOne(
        { requestId: requestId }, 
        { $set: { status: 'rejected', updatedAt: new Date() } }
      );
      return res.status(409).json({ error: 'Squad is full. Request automatically rejected.' });
    }
    
    // 4. Check if the requesting user is already in another squad (e.g., joined one while this request was pending)
    const requestingUser = await usersCollection.findOne({ walletAddress: joinRequest.requestingUserWalletAddress });
    if (!requestingUser) {
        // This should ideally not happen if user existed when creating request
        await squadJoinRequestsCollection.updateOne(
            { requestId: requestId }, 
            { $set: { status: 'rejected', updatedAt: new Date() } }
        );
        return res.status(404).json({ error: 'Requesting user profile not found. Request rejected.' });
    }
    if (requestingUser.squadId) {
        await squadJoinRequestsCollection.updateOne(
            { requestId: requestId }, 
            { $set: { status: 'rejected', updatedAt: new Date() } }
        );
        return res.status(409).json({ error: 'User has joined another squad. Request automatically rejected.' });
    }

    // Use a transaction if available/necessary for atomicity, though separate updates are often fine.
    // For simplicity here, we'll do sequential updates.

    // 5. Update User: add user to squad
    const userUpdateResult = await usersCollection.updateOne(
      { walletAddress: joinRequest.requestingUserWalletAddress }, 
      { $set: { squadId: squad.squadId, updatedAt: new Date() } }
    );
    if (userUpdateResult.modifiedCount === 0) {
        // Handle case where user could not be updated (e.g. user deleted themselves, though unlikely)
        // For now, we proceed, but this could be a rollback point in a transaction.
        console.warn(`User ${joinRequest.requestingUserWalletAddress} could not be updated with squadId, but proceeding.`);
    }

    // 6. Update Squad: add user to member list and potentially update points (if applicable)
    // For now, just adding to member list. Points logic can be added if users contribute points on join.
    const squadUpdateResult = await squadsCollection.updateOne(
      { squadId: squad.squadId }, 
      { 
        $addToSet: { memberWalletAddresses: joinRequest.requestingUserWalletAddress },
        $set: { updatedAt: new Date() }
        // Potential: $inc: { totalSquadPoints: pointsToContributeFromUser } 
      }
    );

    // 7. Update Request: mark as approved
    await squadJoinRequestsCollection.updateOne(
      { requestId: requestId }, 
      { $set: { status: 'approved', updatedAt: new Date() } }
    );

    // 8. Send notifications
    // To requester
    await createNotification(
      db,
      joinRequest.requestingUserWalletAddress,
      'squad_join_request_approved',
      `Your request to join squad "${squad.name}" was approved! Welcome aboard!`,
      squad.squadId,
      squad.name,
      leaderWalletAddress,
      session.user.xUsername || undefined
    );

    // To existing squad members (excluding requester)
    const updatedSquad = await squadsCollection.findOne({ squadId: squad.squadId });
    if (updatedSquad) {
      for (const memberAddr of updatedSquad.memberWalletAddresses) {
        if (memberAddr !== joinRequest.requestingUserWalletAddress) {
          await createNotification(
            db,
            memberAddr,
            'squad_member_joined',
            `@${joinRequest.requestingUserXUsername || joinRequest.requestingUserWalletAddress.substring(0,6)} has joined your squad "${updatedSquad.name}"!`,
            updatedSquad.squadId,
            updatedSquad.name,
            joinRequest.requestingUserWalletAddress,
            joinRequest.requestingUserXUsername || undefined
          );
        }
      }
    }

    return res.status(200).json({ message: 'Join request approved successfully!' });

  } catch (error) {
    console.error("Error approving squad join request:", error);
    return res.status(500).json({ error: 'Failed to approve squad join request' });
  }
} 