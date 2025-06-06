import { NextResponse } from 'next/server';
import { connectToDatabase, SquadDocument, SquadInvitationDocument, UserDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { Db } from 'mongodb';
import { createNotification } from '@/lib/notificationUtils';

interface RevokeInvitationRequestBody {
  invitationId: string;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions) as any;
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const revokingUserWalletAddress = session.user.walletAddress;
  const revokingUserXUsername = session.user.xUsername || revokingUserWalletAddress;

  try {
    const body: RevokeInvitationRequestBody = await request.json();
    const { invitationId } = body;
    if (!invitationId) { return NextResponse.json({ error: 'Invitation ID required.' }, { status: 400 });}

    const { db } = await connectToDatabase();
    const invitationsCollection = db.collection<SquadInvitationDocument>('squadInvitations');
    const squadsCollection = db.collection<SquadDocument>('squads');

    const invitation = await invitationsCollection.findOne({ invitationId });
    if (!invitation) { return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });}
    if (invitation.status !== 'pending') { return NextResponse.json({ error: 'Only pending invitations can be revoked.' }, { status: 400 });}

    const squad = await squadsCollection.findOne({ squadId: invitation.squadId });
    if (!squad) { return NextResponse.json({ error: 'Associated squad not found.'}, { status: 404 });}
    if (squad.leaderWalletAddress !== revokingUserWalletAddress && invitation.invitedByUserWalletAddress !== revokingUserWalletAddress) {
      return NextResponse.json({ error: 'You do not have permission to revoke this invitation.' }, { status: 403 });
    }

    const result = await invitationsCollection.updateOne(
      { invitationId, status: 'pending' },
      { $set: { status: 'revoked', updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) { return NextResponse.json({ error: 'Invitation could not be revoked (it might have been processed already).' }, { status: 409 });}

    await createNotification(
      db,
      invitation.invitedUserWalletAddress,
      'squad_invite_revoked',
      `Your invitation to join "${invitation.squadName}" was revoked by @${revokingUserXUsername}.`,
      invitation.squadId,
      invitation.squadName,
      revokingUserWalletAddress,
      revokingUserXUsername
    );

    return NextResponse.json({ message: 'Squad invitation revoked successfully.' });

  } catch (error) {
    console.error("Error revoking squad invitation:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to revoke squad invitation' }, { status: 500 });
  }
} 