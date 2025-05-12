import { NextResponse } from 'next/server';
import { connectToDatabase, SquadInvitationDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const currentUserWalletAddress = session.user.walletAddress;

  try {
    const { db } = await connectToDatabase();
    const invitationsCollection = db.collection<SquadInvitationDocument>('squad_invitations');

    const pendingInvitations = await invitationsCollection.find({
      invitedUserWalletAddress: currentUserWalletAddress,
      status: 'pending'
    }).sort({ createdAt: -1 }).toArray(); // Sort by newest first

    return NextResponse.json({ invitations: pendingInvitations });

  } catch (error) {
    console.error("Error fetching pending squad invitations:", error);
    return NextResponse.json({ error: 'Failed to fetch pending invitations' }, { status: 500 });
  }
} 