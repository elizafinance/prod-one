import { NextResponse } from 'next/server';
import { connectToDatabase, NotificationDocument, SquadInvitationDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Define a common structure for what a "notification" looks like in the response
// This helps if you merge different types of notifications in the future.
interface UnifiedNotification {
  _id: string; // Can be invitationId or notificationId
  type: 'squad_invite' | 'generic_notification'; // Differentiate source
  message: string;
  squadId?: string; 
  squadName?: string;
  inviterWalletAddress?: string; // For squad invites
  isRead: boolean; // For squad invites, 'pending' status means unread
  createdAt: Date;
  // Add other common fields you might want to display
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const currentUserWalletAddress = session.user.walletAddress;

  const { searchParams } = new URL(request.url);
  // Limit and onlyUnread might apply differently or primarily to generic notifications if you re-add them.
  // For now, with only squad invites, we fetch all pending.
  const limit = parseInt(searchParams.get('limit') || '20'); 
  // const onlyUnread = searchParams.get('unread') === 'true'; // We'll always fetch pending (unread) squad invites

  try {
    const { db } = await connectToDatabase();
    const squadInvitesCollection = db.collection<SquadInvitationDocument>('squadInvitations');
    // const notificationsCollection = db.collection<NotificationDocument>('notifications'); // Keep for future generic notifications

    // 1. Fetch pending squad invitations for the user
    const pendingSquadInvites = await squadInvitesCollection
      .find({
        invitedUserWalletAddress: currentUserWalletAddress,
        status: 'pending' // Pending invites are considered "unread"
      })
      .sort({ createdAt: -1 })
      .limit(limit) // Apply limit to invites fetched for display
      .toArray();

    // 2. Count ALL pending squad invitations for the unread count badge
    const totalUnreadSquadInvites = await squadInvitesCollection.countDocuments({
      invitedUserWalletAddress: currentUserWalletAddress,
      status: 'pending'
    });

    // 3. Transform squad invites into the UnifiedNotification structure for the response
    const unifiedNotifications: UnifiedNotification[] = pendingSquadInvites.map(invite => ({
      _id: invite.invitationId,
      type: 'squad_invite',
      message: `You have a new invitation to join squad: ${invite.squadName}`,
      squadId: invite.squadId,
      squadName: invite.squadName,
      inviterWalletAddress: invite.invitedByUserWalletAddress,
      isRead: false, // 'pending' status implies unread
      createdAt: invite.createdAt || new Date(), // Ensure createdAt is present
    }));
    
    // In the future, if you have other notification types from 'notifications' collection:
    // - Fetch them based on query.isRead if onlyUnread is true for them.
    // - Count their unread items.
    // - Transform and merge them with unifiedNotifications (and sort by date).
    // - Add their unread count to totalUnreadSquadInvites.

    return NextResponse.json({ 
        notifications: unifiedNotifications, // Send the transformed list
        unreadCount: totalUnreadSquadInvites // This is the count for the badge
    });

  } catch (error) {
    console.error("Error fetching user notifications/invites:", error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// It might also be useful to have a POST endpoint to mark notifications as read
// e.g., POST /api/notifications/mark-read with body { notificationIds: ["id1", "id2"] } 