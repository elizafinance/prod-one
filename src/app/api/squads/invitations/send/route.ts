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
  targetUserWalletAddress?: string;
  targetTwitterHandle?: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions) as any;
  if (!session || !session.user || typeof (session.user as any).walletAddress !== 'string') {
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const invitingUserWalletAddress = (session.user as any).walletAddress;
  const invitingUserXUsername = (session.user as any).xUsername || invitingUserWalletAddress;

  try {
    const body: SendInviteRequestBody = await request.json();
    const { squadId, targetUserWalletAddress, targetTwitterHandle } = body;
    
    if (!squadId || (!targetUserWalletAddress && !targetTwitterHandle)) {
      return NextResponse.json({ error: 'Squad ID and either a wallet address or Twitter handle are required.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');
    const usersCollection = db.collection<UserDocument>('users');
    const invitationsCollection = db.collection<SquadInvitationDocument>('squadInvitations');

    const squad = await squadsCollection.findOne({ squadId });
    if (!squad) { return NextResponse.json({ error: 'Squad not found.' }, { status: 404 }); }
    if (squad.leaderWalletAddress !== invitingUserWalletAddress) { return NextResponse.json({ error: 'Only the squad leader can send invitations.' }, { status: 403 }); }
    
    // Find target user by either wallet address or Twitter handle
    let targetUser: UserDocument | null = null;
    
    if (targetUserWalletAddress) {
      targetUser = await usersCollection.findOne({ walletAddress: targetUserWalletAddress });
    } else if (targetTwitterHandle) {
      // Remove @ if included in the handle
      const normalizedHandle = targetTwitterHandle.startsWith('@') 
        ? targetTwitterHandle.substring(1) 
        : targetTwitterHandle;
        
      // Find user by Twitter handle (case insensitive)
      targetUser = await usersCollection.findOne({ 
        xUsername: { $regex: new RegExp(`^${normalizedHandle}$`, 'i') } 
      });
    }
    
    if (!targetUser) { 
      return NextResponse.json({ 
        error: targetTwitterHandle 
          ? `User with Twitter handle @${targetTwitterHandle} not found.` 
          : 'Target user to invite does not exist.' 
      }, { status: 404 }); 
    }
    
    const targetUserWallet = targetUser.walletAddress;
    if (!targetUserWallet) {
      return NextResponse.json({ error: 'Target user does not have a wallet address.' }, { status: 400 });
    }
    
    if (invitingUserWalletAddress === targetUserWallet) {
      return NextResponse.json({ error: 'You cannot invite yourself to a squad.' }, { status: 400 });
    }
    
    if (targetUser.squadId === squadId) {
      return NextResponse.json({ error: 'Target user is already a member of this squad.' }, { status: 400 });
    }
    
    if (squad.maxMembers && squad.memberWalletAddresses.length >= squad.maxMembers) {
      return NextResponse.json({ error: 'This squad has reached its maximum member capacity.' }, { status: 400 });
    } else if (!squad.maxMembers && squad.memberWalletAddresses.length >= (parseInt(process.env.MAX_SQUAD_MEMBERS || '10'))) {
      return NextResponse.json({ error: 'This squad is full.' }, { status: 400 });
    }
    
    const existingInvite = await invitationsCollection.findOne({
      squadId: squadId, 
      invitedUserWalletAddress: targetUserWallet, 
      status: 'pending'
    });
    
    if (existingInvite) { 
      return NextResponse.json({ error: 'An invitation is already pending.' }, { status: 400 }); 
    }

    const invitationId = uuidv4();
    const newInvitation: SquadInvitationDocument = {
      invitationId,
      squadId,
      squadName: squad.name,
      invitedByUserWalletAddress: invitingUserWalletAddress,
      invitedUserWalletAddress: targetUserWallet,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    await invitationsCollection.insertOne(newInvitation);

    // Create notification for the invited user
    const notificationTitle = `Squad Invite: ${squad.name}`;
    const notificationMessage = `@${invitingUserXUsername} invited you to join their squad: "${squad.name}".`;
    const ctaUrl = `/squads/invitations`; // Or a more specific link to view this invite

    await createNotification(
      db,
      targetUserWallet, // recipientWalletAddress
      'squad_invite_received', // type
      notificationTitle,       // title
      notificationMessage,     // message
      ctaUrl,                  // ctaUrl
      undefined,               // relatedQuestId
      undefined,               // relatedQuestTitle
      squadId,                 // relatedSquadId
      squad.name,              // relatedSquadName
      invitingUserWalletAddress, // relatedUserId (the user who sent the invite)
      invitingUserXUsername,   // relatedUserName (the name of the user who sent the invite)
      invitationId             // relatedInvitationId (the ID of the invitation itself)
      // rewardAmount, rewardCurrency, badgeId are not applicable here
    );

    return NextResponse.json({ 
      message: 'Squad invitation sent successfully!', 
      invitation: newInvitation 
    }, { status: 201 });

  } catch (error) {
    console.error("Error sending squad invitation:", error);
    if (error instanceof SyntaxError) { 
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); 
    }
    return NextResponse.json({ error: 'Failed to send squad invitation' }, { status: 500 });
  }
} 