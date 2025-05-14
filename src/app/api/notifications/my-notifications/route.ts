import { NextResponse } from 'next/server';
import { connectToDatabase, NotificationDocument, SquadInvitationDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ObjectId } from 'mongodb'; // Import ObjectId

// Define a common structure for what a "notification" looks like in the response
// This helps if you merge different types of notifications in the future.
interface UnifiedNotification {
  _id: string; // Can be invitationId or notificationId (using ObjectId for generic)
  type: 'squad_invite' | 'generic_notification'; // Differentiate source
  message: string;
  squadId?: string; 
  squadName?: string;
  inviterWalletAddress?: string; // For squad invites
  isRead: boolean; // For squad invites, 'pending' status means unread. For generic, use the field.
  createdAt: Date;
  // Add other common fields you might want to display
  // Fields from NotificationDocument might be needed here too if used in UI
  relatedSquadId?: string;
  relatedUserWalletAddress?: string;
  relatedUserXUsername?: string;
  notificationType?: string; // Store the original generic type
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
  const onlyUnreadParam = searchParams.get('unread') === 'true'; // Optional param to fetch only unread generic notifications

  try {
    const { db } = await connectToDatabase();
    const squadInvitesCollection = db.collection<SquadInvitationDocument>('squadInvitations');
    const notificationsCollection = db.collection<NotificationDocument>('notifications'); // Re-enable generic notifications

    // 1. Fetch pending squad invitations for the user
    // We still fetch all pending invites regardless of 'limit' for count, but apply limit for the list itself.
    const pendingSquadInvites = await squadInvitesCollection
      .find({
        invitedUserWalletAddress: currentUserWalletAddress,
        status: 'pending' // Pending invites are considered "unread"
      })
      .sort({ createdAt: -1 })
      // Limit applied later after merging, or we apply here? Let's apply limit after merge for overall recency.
      // .limit(limit) 
      .toArray();

    // 2. Count ALL pending squad invitations for the unread count badge
    const totalUnreadSquadInvites = await squadInvitesCollection.countDocuments({
      invitedUserWalletAddress: currentUserWalletAddress,
      status: 'pending'
    });

    // 3. Fetch generic notifications from the 'notifications' collection
    const genericQuery: any = { recipientWalletAddress: currentUserWalletAddress };
    if (onlyUnreadParam) {
      genericQuery.isRead = false;
    }

    const genericNotifications = await notificationsCollection
        .find(genericQuery)
        .sort({ createdAt: -1 })
        // Apply limit later after merging
        // .limit(limit)
        .toArray();

    // 4. Count unread generic notifications
    const totalUnreadGeneric = await notificationsCollection.countDocuments({
        recipientWalletAddress: currentUserWalletAddress,
        isRead: false
    });

    // 5. Transform squad invites into the UnifiedNotification structure
    const unifiedSquadInvites: UnifiedNotification[] = pendingSquadInvites.map(invite => ({
      _id: invite.invitationId, // Use invitationId as _id
      type: 'squad_invite',
      message: `You have a new invitation to join squad: ${invite.squadName}`,
      squadId: invite.squadId,
      squadName: invite.squadName,
      inviterWalletAddress: invite.invitedByUserWalletAddress,
      isRead: false, // 'pending' status implies unread
      createdAt: invite.createdAt || new Date(), // Ensure createdAt is present
    }));

    // 6. Transform generic notifications into the UnifiedNotification structure
    const unifiedGenericNotifications: UnifiedNotification[] = genericNotifications.map(notif => ({
      _id: notif.notificationId, // Use the custom notificationId field
      type: 'generic_notification',
      message: notif.message,
      isRead: notif.isRead,
      createdAt: notif.createdAt || new Date(),
      // Include other relevant fields from NotificationDocument
      relatedSquadId: notif.relatedSquadId,
      relatedSquadName: notif.relatedSquadName,
      relatedUserWalletAddress: notif.relatedUserWalletAddress,
      relatedUserXUsername: notif.relatedUserXUsername,
      notificationType: notif.type // Store original type
    }));
    
    // 7. Merge and sort all notifications
    let allUnifiedNotifications = [...unifiedSquadInvites, ...unifiedGenericNotifications];
    allUnifiedNotifications.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

    // 8. Apply the limit to the combined list
    const limitedNotifications = allUnifiedNotifications.slice(0, limit);

    // 9. Calculate total unread count
    const totalUnreadCount = totalUnreadSquadInvites + totalUnreadGeneric;

    return NextResponse.json({ 
        notifications: limitedNotifications, // Send the merged, sorted, and limited list
        unreadCount: totalUnreadCount // Send the combined unread count
    });

  } catch (error) {
    console.error("Error fetching user notifications/invites:", error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// It might also be useful to have a POST endpoint to mark notifications as read
// e.g., POST /api/notifications/mark-read with body { notificationIds: ["id1", "id2"] } 