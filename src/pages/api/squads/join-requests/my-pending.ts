import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase, ISquadJoinRequest } from '@/lib/mongodb';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  const userWalletAddress = session.user.walletAddress;

  try {
    const { db } = await connectToDatabase();
    const squadJoinRequestsCollection = db.collection<ISquadJoinRequest>('squadjoinrequests');

    const pendingRequests = await squadJoinRequestsCollection.find({
      requestingUserWalletAddress: userWalletAddress,
      status: 'pending'
    }).project({ squadId: 1, status: 1, requestId: 1, squadName: 1 }) // Only fetch necessary fields
    .toArray();

    return NextResponse.json({ requests: pendingRequests }, { status: 200 });

  } catch (error) {
    console.error("Error fetching user's pending squad join requests:", error);
    return NextResponse.json({ error: 'Failed to fetch pending join requests' }, { status: 500 });
  }
} 