import { NextResponse } from 'next/server';
import {
  connectToDatabase,
  UserDocument,
  SquadDocument,
  SquadInvitationDocument
} from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { v4 as uuidv4 } from 'uuid';
import { createNotification } from '@/lib/notificationUtils';

interface SendInviteRequestBody {
  squadId: string;
  targetUserWalletAddress: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const invitingUserWalletAddress = session.user.walletAddress;
  const invitingUserXUsername = session.user.xUsername || invitingUserWalletAddress;

  try {
    const body: SendInviteRequestBody = await request.json();
    const { squadId, targetUserWalletAddress } = body;
    if (!squadId || !targetUserWalletAddress) {
      return NextResponse.json({ error: 'Squad ID and target user wallet address are required.' }, { status: 400 });
    }
    if (invitingUserWalletAddress === targetUserWalletAddress) {
      return NextResponse.json({ error: 'You cannot invite yourself to a squad.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');
    const usersCollection = db.collection<UserDocument>('users');
    const invitationsCollection = db.collection<SquadInvitationDocument>('squad_invitations');

    const squad = await squadsCollection.findOne({ squadId });
    if (!squad) { return NextResponse.json({ error: 'Squad not found.' }, { status: 404 }); }
    if (squad.leaderWalletAddress !== invitingUserWalletAddress) { return NextResponse.json({ error: 'Only the squad leader can send invitations.' }, { status: 403 }); }
    const targetUser = await usersCollection.findOne({ walletAddress: targetUserWalletAddress });
    if (!targetUser) { return NextResponse.json({ error: 'Target user to invite does not exist.' }, { status: 404 }); }
    if (targetUser.squadId) { 
        if (targetUser.squadId === squadId) return NextResponse.json({ error: 'Target user is already a member of this squad.' }, { status: 400 });
        return NextResponse.json({ error: 'Target user is already in another squad.' }, { status: 400 });
    }
    if (squad.memberWalletAddresses.length >= (parseInt(process.env.MAX_SQUAD_MEMBERS || '10'))) { return NextResponse.json({ error: 'This squad is full.' }, { status: 400 }); }
    const existingInvite = await invitationsCollection.findOne({squadId: squadId, invitedUserWalletAddress: targetUserWalletAddress, status: 'pending'});
    if (existingInvite) { return NextResponse.json({ error: 'An invitation is already pending.' }, { status: 400 }); }

    const invitationId = uuidv4();
    const newInvitation: SquadInvitationDocument = {
      invitationId, squadId, squadName: squad.name,
      invitedByUserWalletAddress: invitingUserWalletAddress,
      invitedUserWalletAddress: targetUserWalletAddress,
      status: 'pending', createdAt: new Date(), updatedAt: new Date(),
    };
    await invitationsCollection.insertOne(newInvitation);

    await createNotification(
      db,
      targetUserWalletAddress,
      'squad_invite_received',
      `You have been invited to join the squad "${squad.name}" by @${invitingUserXUsername}.`,
      squadId,
      squad.name,
      invitingUserWalletAddress,
      invitingUserXUsername
    );

    return NextResponse.json({ 
      message: 'Squad invitation sent successfully!', 
      invitation: newInvitation 
    }, { status: 201 });

  } catch (error) {
    console.error("Error sending squad invitation:", error);
    if (error instanceof SyntaxError) { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
    return NextResponse.json({ error: 'Failed to send squad invitation' }, { status: 500 });
  }
} 