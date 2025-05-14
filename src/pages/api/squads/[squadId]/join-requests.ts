import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase, SquadDocument, ISquadJoinRequest } from '@/lib/mongodb';
// SquadJoinRequest model is not directly used here for new doc creation, db.collection is used for reads.

export async function GET(request: Request, { params }: { params: { squadId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  const { squadId } = params;
  if (!squadId) {
    return NextResponse.json({ error: 'Squad ID is required' }, { status: 400 });
  }

  const userWalletAddress = session.user.walletAddress;

  try {
    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');
    const squadJoinRequestsCollection = db.collection<ISquadJoinRequest>('squadjoinrequests');

    // 1. Verify the current user is the leader of the squad
    const squad = await squadsCollection.findOne({ squadId: squadId });
    if (!squad) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    if (squad.leaderWalletAddress !== userWalletAddress) {
      return NextResponse.json({ error: 'Only the squad leader can view join requests.' }, { status: 403 });
    }

    // 2. Fetch pending join requests for this squad
    const pendingRequests = await squadJoinRequestsCollection.find({
      squadId: squadId,
      status: 'pending'
    }).sort({ createdAt: -1 }) // Show newest requests first
    .toArray();

    return NextResponse.json({ requests: pendingRequests }, { status: 200 });

  } catch (error) {
    console.error("Error fetching squad join requests:", error);
    return NextResponse.json({ error: 'Failed to fetch squad join requests' }, { status: 500 });
  }
} 