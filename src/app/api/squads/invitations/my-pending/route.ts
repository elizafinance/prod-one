import { NextResponse } from 'next/server';
import { connectToDatabase, SquadInvitationDocument, UserDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

interface EnrichedSquadInvitation extends SquadInvitationDocument {
  inviterInfo?: {
    xUsername?: string;
    xProfileImageUrl?: string;
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions) as any;
  console.log('[MyPendingInvitesAPI] Session:', JSON.stringify(session));
  let currentUserWalletAddress = '';
  if (session && session.user && typeof (session.user as any).walletAddress === 'string') {
    currentUserWalletAddress = (session.user as any).walletAddress;
  }
  if (!session || !session.user || !currentUserWalletAddress) {
    console.warn('[MyPendingInvitesAPI] Not authenticated or walletAddress missing. Session:', session);
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  console.log('[MyPendingInvitesAPI] Current user wallet address:', currentUserWalletAddress);

  try {
    const { db } = await connectToDatabase();
    const invitationsCollection = db.collection<SquadInvitationDocument>('squadInvitations');
    const usersCollection = db.collection<UserDocument>('users');

    const pendingInvitations = await invitationsCollection.find({
      invitedUserWalletAddress: currentUserWalletAddress,
      status: 'pending'
    }).sort({ createdAt: -1 }).toArray(); // Sort by newest first
    console.log('[MyPendingInvitesAPI] Pending invitations found:', pendingInvitations);

    // Get wallet addresses of inviters to fetch their profile info
    const inviterWallets = pendingInvitations.map(invite => invite.inviterWalletAddress ?? invite.invitedByUserWalletAddress!);
    const inviterUsers = await usersCollection.find(
      { walletAddress: { $in: inviterWallets } },
      { projection: { walletAddress: 1, xUsername: 1, xProfileImageUrl: 1, _id: 0 } }
    ).toArray();

    // Create a map for quick lookup
    const inviterUserMap = new Map<string, Partial<UserDocument>>();
    inviterUsers.forEach(user => {
      if (user.walletAddress) {
        inviterUserMap.set(user.walletAddress, user);
      }
    });

    // Enrich the invitations with inviter info
    const enrichedInvitations: EnrichedSquadInvitation[] = pendingInvitations.map(invite => {
      const inviterInfo = inviterUserMap.get(invite.inviterWalletAddress ?? invite.invitedByUserWalletAddress!);
      return {
        ...invite,
        inviterInfo: inviterInfo 
          ? { 
              xUsername: inviterInfo.xUsername,
              xProfileImageUrl: inviterInfo.xProfileImageUrl
            } 
          : undefined
      };
    });

    return NextResponse.json({ invitations: enrichedInvitations });

  } catch (error) {
    console.error("Error fetching pending squad invitations:", error);
    return NextResponse.json({ error: 'Failed to fetch pending invitations' }, { status: 500 });
  }
} 