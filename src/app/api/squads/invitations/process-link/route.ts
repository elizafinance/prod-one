import { NextResponse } from 'next/server';
import {
  connectToDatabase,
  SquadDocument,
  SquadInvitationDocument,
  UserDocument,
} from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { createNotification } from '@/lib/notificationUtils';

interface ProcessInviteRequestBody {
  squadId: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (
    !session ||
    !session.user ||
    typeof (session.user as any).walletAddress !== 'string'
  ) {
    return NextResponse.json(
      { error: 'User not authenticated or wallet not available in session' },
      { status: 401 }
    );
  }
  const currentUserWalletAddress = (session.user as any).walletAddress;

  try {
    const body: ProcessInviteRequestBody = await request.json();
    const { squadId } = body;

    if (!squadId) {
      return NextResponse.json(
        { error: 'Squad ID is required.' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');
    const invitationsCollection = db.collection<SquadInvitationDocument>('squadInvitations');
    const usersCollection = db.collection<UserDocument>('users');

    // 1. Ensure user record exists and is not already in a squad
    const currentUserDoc = await usersCollection.findOne({ walletAddress: currentUserWalletAddress });
    if (!currentUserDoc) {
      return NextResponse.json(
        { error: 'Current user not found in database.' },
        { status: 404 }
      );
    }
    if (currentUserDoc.squadId) {
      return NextResponse.json(
        { error: 'You are already in a squad.' },
        { status: 400 }
      );
    }

    // 2. Validate squad exists
    const targetSquad = await squadsCollection.findOne({ squadId });
    if (!targetSquad) {
      return NextResponse.json(
        { error: 'Squad not found.' },
        { status: 404 }
      );
    }

    // 3. Ensure squad has capacity
    const maxMembers = parseInt(
      process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || '10',
      10
    );
    if (targetSquad.memberWalletAddresses.length >= maxMembers) {
      return NextResponse.json(
        { error: 'This squad is full.' },
        { status: 400 }
      );
    }

    // 4. Check for existing pending invite
    const existingInvite = await invitationsCollection.findOne({
      squadId,
      invitedUserWalletAddress: currentUserWalletAddress,
      status: 'pending',
    });
    if (existingInvite) {
      return NextResponse.json(
        { message: 'An invitation is already pending.', invitation: existingInvite },
        { status: 200 }
      );
    }

    // 5. Create new invitation
    const invitationId = uuidv4();
    const newInvitation: SquadInvitationDocument = {
      invitationId,
      squadId,
      squadName: targetSquad.name,
      invitedByUserWalletAddress: targetSquad.leaderWalletAddress,
      invitedUserWalletAddress: currentUserWalletAddress,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await invitationsCollection.insertOne(newInvitation);

    // 6. Create notification for user
    await createNotification(
      db,
      currentUserWalletAddress,
      'squad_invite_received',
      `You have been invited to join the squad "${targetSquad.name}" by the leader.`,
      squadId,
      targetSquad.name,
      targetSquad.leaderWalletAddress,
      undefined,
      invitationId
    );

    return NextResponse.json(
      { message: 'Squad invitation received!', invitation: newInvitation },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error processing squad invite from link:', error);
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to process squad invitation' },
      { status: 500 }
    );
  }
} 