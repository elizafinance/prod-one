import { NextResponse } from 'next/server';
import { connectToDatabase, NotificationDocument, SquadInvitationDocument, UserDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ObjectId } from 'mongodb'; // Import ObjectId

const NOTIFICATIONS_LIMIT_TOTAL = 20;

// Interface for objects after merging generic and invite-based notifications
interface MergedNotification extends Partial<NotificationDocument> {
  _id?: ObjectId; // Keep as ObjectId or undefined, string conversion at the very end
  source: 'generic' | 'invite'; // Distinguish the origin
  // Ensure all fields accessed in the final map are present here, even if optional
  // from NotificationDocument (userId, type, title, message etc. are already in Partial<NotificationDocument>)
  // Fields specifically from SquadInvitationDocument might be transformed into NotificationDocument fields already
  // For example, invite.squadId becomes relatedSquadId in squadInviteNotifications mapping.
  // No need to list them separately if they align with NotificationDocument fields.
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }
  const currentUserWalletAddress = session.user.walletAddress;

  const { searchParams } = new URL(request.url);
  // Limit and onlyUnread might apply differently or primarily to generic notifications if you re-add them.
  // For now, with only squad invites, we fetch all pending.
  const limit = parseInt(searchParams.get('limit') || '20'); 
  const onlyUnreadParam = searchParams.get('unread') === 'true'; // Optional param to fetch only unread generic notifications

  try {
    const { db } = await connectToDatabase();
    const notificationsCollection = db.collection<NotificationDocument>('notifications');
    const squadInvitesCollection = db.collection<SquadInvitationDocument>('squadInvitations');

    const genericDbNotifications = await notificationsCollection
      .find({
        userId: currentUserWalletAddress,
        isArchived: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Add source to generic notifications
    const genericNotificationsWithSource: MergedNotification[] = genericDbNotifications.map(n => ({
      ...n,
      _id: n._id, // ObjectId from DB
      source: 'generic' as 'generic',
    }));

    // Keep the squad-goals version for fetching and transforming squad invitations
    const squadInvitations = await squadInvitesCollection
      .find({
        invitedUserWalletAddress: currentUserWalletAddress,
        status: 'pending',
      })
      .sort({ createdAt: -1 })
      .toArray();

    const squadInviteNotifications: MergedNotification[] = squadInvitations.map(invite => ({
      _id: invite._id, 
      userId: invite.invitedUserWalletAddress,
      type: 'squad_invite_received', 
      title: `Invitation: Join ${invite.squadName}`,
      message: `${invite.invitedByUserWalletAddress} invited you to join their squad: ${invite.squadName}.`,
      ctaUrl: `/squads/invitations`,
      isRead: false, 
      createdAt: invite.createdAt,
      updatedAt: invite.updatedAt,
      relatedSquadId: invite.squadId,
      relatedSquadName: invite.squadName,
      relatedUserId: invite.invitedByUserWalletAddress,
      relatedInvitationId: invite.invitationId,
      source: 'invite' as 'invite', 
    }));

    const allNotificationsRaw: MergedNotification[] = [
        ...genericNotificationsWithSource,
        ...squadInviteNotifications
    ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    
    const limitedNotifications = allNotificationsRaw.slice(0, NOTIFICATIONS_LIMIT_TOTAL);

    const totalUnreadSquadInvites = squadInviteNotifications.length; 
    const totalUnreadGeneric = genericDbNotifications.filter(n => !n.isRead).length;
    const totalUnreadCount = totalUnreadSquadInvites + totalUnreadGeneric;

    const transformedNotifications = limitedNotifications.map((notif: MergedNotification) => {
      // Now `notif` is of type MergedNotification, which extends Partial<NotificationDocument>
      // and includes `source`. All fields from NotificationDocument are optional here.
      return {
        _id: notif._id?.toString(), // Convert ObjectId to string here for the response
        notificationId: notif.source === 'invite' ? notif.relatedInvitationId : notif._id?.toString(),
        userId: notif.userId,
        type: notif.type,
        title: notif.title,
        message: notif.message,
        ctaUrl: notif.ctaUrl,
        isRead: notif.isRead,
        createdAt: notif.createdAt,
        updatedAt: notif.updatedAt,
        relatedQuestId: notif.relatedQuestId,
        relatedQuestTitle: notif.relatedQuestTitle,
        relatedSquadId: notif.relatedSquadId,
        relatedSquadName: notif.relatedSquadName,
        relatedUserId: notif.relatedUserId, // Correct field name
        relatedUserName: notif.relatedUserName, // Correct field name
        relatedInvitationId: notif.relatedInvitationId,
        rewardAmount: notif.rewardAmount,
        rewardCurrency: notif.rewardCurrency,
        badgeId: notif.badgeId,
      };
    });

    return NextResponse.json({ 
        notifications: transformedNotifications,
        unreadCount: totalUnreadCount
    });

  } catch (error) {
    console.error("Error fetching user notifications:", error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// It might also be useful to have a POST endpoint to mark notifications as read
// e.g., POST /api/notifications/mark-read with body { notificationIds: ["id1", "id2"] } 