import { NextResponse } from 'next/server';
import { connectToDatabase, SquadInvitationDocument, SquadDocument } from '@/lib/mongodb';
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
    const squadsCollection = db.collection<SquadDocument>('squads');

    // Find squads where the current user is the leader
    const myLedSquads = await squadsCollection.find(
        { leaderWalletAddress: currentUserWalletAddress },
        { projection: { squadId: 1 } }
    ).toArray();
    const myLedSquadIds = myLedSquads.map(s => s.squadId);

    // Fetch pending invitations sent by the user OR from squads they lead
    const sentInvitations = await invitationsCollection.find({
      status: 'pending',
      $or: [
        { invitedByUserWalletAddress: currentUserWalletAddress },
        { squadId: { $in: myLedSquadIds } } // Invites sent from any squad they lead
      ]
    }).sort({ createdAt: -1 }).toArray();

    // Deduplicate if an invite was sent by leader from their own squad (would match both conditions)
    const uniqueInvitations = Array.from(new Map(sentInvitations.map(item => [item.invitationId, item])).values());

    return NextResponse.json({ invitations: uniqueInvitations });

  } catch (error) {
    console.error("Error fetching sent squad invitations:", error);
    return NextResponse.json({ error: 'Failed to fetch sent invitations' }, { status: 500 });
  }
} 