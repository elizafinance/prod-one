import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase, ISquadJoinRequest, SquadDocument } from '@/lib/mongodb'; // Assuming ISquadJoinRequest is exported from mongodb.ts
import { createNotification } from '@/lib/notificationUtils';

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
    const squadJoinRequestsCollection = db.collection<ISquadJoinRequest>('squadjoinrequests');
    const squadsCollection = db.collection<SquadDocument>('squads');

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
      // This case should be rare if request integrity is maintained
      return NextResponse.json({ error: 'Squad not found for this request. Cannot verify leader.' }, { status: 404 });
    }
    if (squad.leaderWalletAddress !== leaderWalletAddress) {
      return NextResponse.json({ error: 'Only the squad leader can reject requests.' }, { status: 403 });
    }

    // 3. Update Request: mark as rejected
    const updateResult = await squadJoinRequestsCollection.updateOne(
      { requestId: requestId }, 
      { $set: { status: 'rejected', updatedAt: new Date() } }
    );

    if (updateResult.modifiedCount === 0) {
        // Should not happen if status was pending and requestId is correct
        return NextResponse.json({ error: 'Failed to update request status. It might have been processed by another action.' }, { status: 500 });
    }

    // 4. Send notification to requester
    await createNotification(
      db,
      joinRequest.requestingUserWalletAddress,
      'squad_join_request_rejected',
      `Your request to join squad "${joinRequest.squadName}" was rejected.`,
      joinRequest.squadId,
      joinRequest.squadName,
      leaderWalletAddress,
      session.user.xUsername || undefined
    );

    return NextResponse.json({ message: 'Join request rejected successfully' }, { status: 200 });

  } catch (error) {
    console.error("Error rejecting squad join request:", error);
    return NextResponse.json({ error: 'Failed to reject squad join request' }, { status: 500 });
  }
} 