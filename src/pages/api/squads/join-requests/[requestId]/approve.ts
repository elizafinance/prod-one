import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase, UserDocument, SquadDocument, ISquadJoinRequest } from '@/lib/mongodb';
import { SquadJoinRequest } from '@/models/SquadJoinRequest';
import { createNotification } from '@/lib/notificationUtils';

// Constant for max members, could be from env or config
const MAX_SQUAD_MEMBERS = parseInt(process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || '50', 10);

export async function POST(request: Request, { params }: { params: { requestId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  const { requestId } = params;
  if (!requestId) {
    return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
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
      return NextResponse.json({ error: 'Join request not found' }, { status: 404 });
    }
    if (joinRequest.status !== 'pending') {
      return NextResponse.json({ error: 'This request has already been processed.' }, { status: 400 });
    }

    // 2. Verify the current user is the leader of the squad associated with the request
    const squad = await squadsCollection.findOne({ squadId: joinRequest.squadId });
    if (!squad) {
      return NextResponse.json({ error: 'Squad not found for this request' }, { status: 404 });
    }
    if (squad.leaderWalletAddress !== leaderWalletAddress) {
      return NextResponse.json({ error: 'Only the squad leader can approve requests.' }, { status: 403 });
    }

    // 3. Check if squad is full
    const memberLimit = squad.maxMembers || MAX_SQUAD_MEMBERS;
    if (squad.memberWalletAddresses.length >= memberLimit) {
      // Optionally, reject the request automatically or just inform leader
      await squadJoinRequestsCollection.updateOne(
        { requestId: requestId }, 
        { $set: { status: 'rejected', updatedAt: new Date() } }
      );
      return NextResponse.json({ error: 'Squad is full. Request automatically rejected.' }, { status: 409 }); // 409 Conflict
    }
    
    // 4. Check if the requesting user is already in another squad (e.g., joined one while this request was pending)
    const requestingUser = await usersCollection.findOne({ walletAddress: joinRequest.requestingUserWalletAddress });
    if (!requestingUser) {
        // This should ideally not happen if user existed when creating request
        await squadJoinRequestsCollection.updateOne(
            { requestId: requestId }, 
            { $set: { status: 'rejected', updatedAt: new Date() } }
        );
        return NextResponse.json({ error: 'Requesting user profile not found. Request rejected.' }, { status: 404 });
    }
    if (requestingUser.squadId) {
        await squadJoinRequestsCollection.updateOne(
            { requestId: requestId }, 
            { $set: { status: 'rejected', updatedAt: new Date() } }
        );
        return NextResponse.json({ error: 'User has joined another squad. Request automatically rejected.' }, { status: 409 });
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

    return NextResponse.json({ message: 'Join request approved successfully!' }, { status: 200 });

  } catch (error) {
    console.error("Error approving squad join request:", error);
    return NextResponse.json({ error: 'Failed to approve squad join request' }, { status: 500 });
  }
} 