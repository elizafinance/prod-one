import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createNotification } from '@/lib/notificationUtils';
export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
        return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
    }
    const currentUserWalletAddress = session.user.walletAddress;
    const currentUserXUsername = session.user.xUsername || currentUserWalletAddress;
    try {
        const body = await request.json();
        const { invitationId } = body;
        if (!invitationId) {
            return NextResponse.json({ error: 'Invitation ID required.' }, { status: 400 });
        }
        const { db } = await connectToDatabase();
        const invitationsCollection = db.collection('squadInvitations');
        const invitation = await invitationsCollection.findOne({
            invitationId,
            invitedUserWalletAddress: currentUserWalletAddress,
            status: 'pending'
        });
        if (!invitation) {
            return NextResponse.json({ error: 'Invitation not found, already processed, or not intended for you.' }, { status: 404 });
        }
        const result = await invitationsCollection.updateOne({ invitationId }, { $set: { status: 'declined', updatedAt: new Date() } });
        if (result.matchedCount === 0) {
            return NextResponse.json({ error: 'Invitation could not be declined (already processed).' }, { status: 409 });
        }
        await createNotification(db, invitation.invitedByUserWalletAddress, 'squad_invite_declined', `@${currentUserXUsername} has declined your invitation to join "${invitation.squadName}".`, invitation.squadId, invitation.squadName, currentUserWalletAddress, currentUserXUsername);
        return NextResponse.json({ message: 'Squad invitation declined successfully.' });
    }
    catch (error) {
        console.error("Error declining squad invitation:", error);
        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to decline squad invitation' }, { status: 500 });
    }
}
