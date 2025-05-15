import { NextResponse } from 'next/server';
import {
  connectToDatabase,
  UserDocument,
  SquadDocument,
  SquadInvitationDocument
} from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { Db } from 'mongodb';
import { createNotification } from '@/lib/notificationUtils';

interface AcceptInvitationRequestBody {
  invitationId: string;
}

// Ensure MAX_SQUAD_MEMBERS is consistent with join/route.ts or make it globally available
const DEFAULT_MAX_SQUAD_MEMBERS = 10;
const MAX_SQUAD_MEMBERS = parseInt(process.env.MAX_SQUAD_MEMBERS || '') || DEFAULT_MAX_SQUAD_MEMBERS;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const currentUserWalletAddress = session.user.walletAddress;
  const currentUserXUsername = session.user.xUsername || currentUserWalletAddress;

  try {
    const body: AcceptInvitationRequestBody = await request.json();
    const { invitationId } = body;

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const invitationsCollection = db.collection<SquadInvitationDocument>('squadInvitations');
    const usersCollection = db.collection<UserDocument>('users');
    const squadsCollection = db.collection<SquadDocument>('squads');

    // 1. Find the pending invitation
    const invitation = await invitationsCollection.findOne({
      invitationId,
      invitedUserWalletAddress: currentUserWalletAddress,
      status: 'pending',
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found, already processed, or not intended for you.' }, { status: 404 });
    }

    // 2. Check user's current squad status (they shouldn't be in one)
    const user = await usersCollection.findOne({ walletAddress: currentUserWalletAddress });
    if (!user) {
      return NextResponse.json({ error: 'Authenticated user not found in database.' }, { status: 404 }); // Should not happen
    }

    let pointsToContribute = user.points || 0;
    
    // If user is already in a squad, leave that squad first
    if (user.squadId) {
      console.log(`User ${currentUserWalletAddress} is leaving squad ${user.squadId} to join ${invitation.squadId}`);
      
      const currentSquad = await squadsCollection.findOne({ squadId: user.squadId });
      if (currentSquad) {
        // If they're the squad leader, reject (they must transfer leadership or disband first)
        if (currentSquad.leaderWalletAddress === currentUserWalletAddress) {
          await invitationsCollection.updateOne(
            { invitationId }, 
            { $set: { status: 'declined', updatedAt: new Date(), notes: 'User is a squad leader' } }
          );
          return NextResponse.json({ 
            error: 'You are the leader of your current squad. Transfer leadership or disband your squad first.' 
          }, { status: 400 });
        }
        
        // Remove user from their current squad and deduct their points
        await squadsCollection.updateOne(
          { squadId: user.squadId },
          { 
            $pull: { memberWalletAddresses: currentUserWalletAddress },
            $set: { updatedAt: new Date() }
          }
        );
        
        // Notify current squad members that user has left
        for (const memberAddr of currentSquad.memberWalletAddresses) {
          if (memberAddr !== currentUserWalletAddress) {
            await createNotification(
              db, 
              memberAddr, 
              'squad_member_left',
              `@${currentUserXUsername} has left your squad "${currentSquad.name}" to join another squad.`,
              currentSquad.squadId,
              currentSquad.name,
              currentUserWalletAddress,
              currentUserXUsername
            );
          }
        }
      }
    }

    // 3. Check target squad status (exists, not full)
    const squadToJoin = await squadsCollection.findOne({ squadId: invitation.squadId });
    if (!squadToJoin) {
      await invitationsCollection.updateOne({ invitationId }, { $set: { status: 'revoked', updatedAt: new Date(), notes: 'Squad no longer exists' } });
      return NextResponse.json({ error: 'The squad for this invitation no longer exists.' }, { status: 404 });
    }
    
    // Check against maxMembers if that property exists
    const memberLimit = squadToJoin.maxMembers || MAX_SQUAD_MEMBERS;
    if (squadToJoin.memberWalletAddresses.length >= memberLimit) {
      await invitationsCollection.updateOne({ invitationId }, { $set: { status: 'declined', updatedAt: new Date(), notes: 'Squad was full' } });
      return NextResponse.json({ error: 'The squad is full.' }, { status: 400 });
    }
    
    // 4. Process joining the squad (similar to /api/squads/join)
    await squadsCollection.updateOne(
      { squadId: invitation.squadId },
      {
        $addToSet: { memberWalletAddresses: currentUserWalletAddress },
        $set: { updatedAt: new Date() },
      }
    );

    await usersCollection.updateOne(
      { walletAddress: currentUserWalletAddress },
      {
        $set: { squadId: invitation.squadId, updatedAt: new Date() },
        // $set: { pointsContributedToSquad: pointsToContribute }, // If tracking this
      }
    );

    // 5. Update invitation status to 'accepted'
    await invitationsCollection.updateOne(
      { invitationId },
      { $set: { status: 'accepted', updatedAt: new Date() } }
    );

    // Create notification for the user who sent the invite (or squad leader)
    await createNotification(
      db,
      invitation.invitedByUserWalletAddress,
      'squad_invite_accepted',
      `@${currentUserXUsername} has accepted your invitation to join "${squadToJoin.name}"!`,
      squadToJoin.squadId,
      squadToJoin.name,
      currentUserWalletAddress,
      currentUserXUsername
    );

    // Notify other squad members (excluding the one who just joined and the inviter if they are different from leader)
    squadToJoin.memberWalletAddresses.forEach(async (memberAddress) => {
      if (memberAddress !== currentUserWalletAddress && memberAddress !== invitation.invitedByUserWalletAddress) {
        await createNotification(
          db,
          memberAddress,
          'squad_member_joined',
          `@${currentUserXUsername} has joined your squad "${squadToJoin.name}"!`,
          squadToJoin.squadId,
          squadToJoin.name,
          currentUserWalletAddress,
          currentUserXUsername
        );
      }
    });

    return NextResponse.json({ message: `Successfully joined squad: ${squadToJoin.name}! You contributed ${pointsToContribute} points.` });

  } catch (error) {
    console.error("Error accepting squad invitation:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to accept squad invitation' }, { status: 500 });
  }
} 