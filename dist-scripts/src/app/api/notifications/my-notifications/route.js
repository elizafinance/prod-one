import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
export async function GET(request) {
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
        const squadInvitesCollection = db.collection('squadInvitations');
        const notificationsCollection = db.collection('notifications'); // Re-enable generic notifications
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
        const genericQuery = { recipientWalletAddress: currentUserWalletAddress };
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
        const unifiedSquadInvites = pendingSquadInvites.map(invite => ({
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
        const unifiedGenericNotifications = genericNotifications.map(notif => ({
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
    }
    catch (error) {
        console.error("Error fetching user notifications/invites:", error);
        return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
    }
}
// It might also be useful to have a POST endpoint to mark notifications as read
// e.g., POST /api/notifications/mark-read with body { notificationIds: ["id1", "id2"] } 
