import { NextResponse } from 'next/server';
import { connectToDatabase, NotificationDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { NotificationDisplayData } from '@/components/notifications/NotificationItem';

const DEFAULT_NOTIFICATIONS_LIMIT = 20; // Define a default limit

export async function GET(request: Request) {
  const session = await getServerSession(authOptions) as any;

  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated or wallet not linked' }, { status: 401 });
  }
  const userWalletAddress = session.user.walletAddress;

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || DEFAULT_NOTIFICATIONS_LIMIT.toString(), 10);
  const skip = (page - 1) * limit;

  try {
    const { db } = await connectToDatabase();
    const notificationsCollection = db.collection<NotificationDocument>('notifications');

    const query = { recipientWalletAddress: userWalletAddress };

    const totalNotifications = await notificationsCollection.countDocuments(query);
    const totalPages = Math.ceil(totalNotifications / limit);

    const dbNotifications = await notificationsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const transformedNotifications: NotificationDisplayData[] = dbNotifications.map(doc => ({
      _id: doc._id!.toString(),
      notificationId: doc.notificationId,
      userId: doc.recipientWalletAddress,
      type: doc.type,
      title: doc.title,
      message: doc.message,
      isRead: doc.isRead,
      ctaUrl: doc.ctaUrl,
      createdAt: doc.createdAt?.toISOString(),
      updatedAt: doc.updatedAt?.toISOString(),
      relatedQuestId: doc.relatedQuestId,
      relatedQuestTitle: doc.relatedQuestTitle,
      relatedSquadId: doc.relatedSquadId,
      relatedSquadName: doc.relatedSquadName,
      relatedUserId: doc.relatedUserId,
      relatedUserName: doc.relatedUserName,
      relatedInvitationId: doc.relatedInvitationId,
      rewardAmount: doc.rewardAmount,
      rewardCurrency: doc.rewardCurrency,
      badgeId: doc.badgeId,
    }));

    const unreadCount = await notificationsCollection.countDocuments({
        ...query,
        isRead: false
    });

    return NextResponse.json({
      notifications: transformedNotifications,
      unreadCount,
      currentPage: page,
      totalPages,
      totalNotifications,
    });
  } catch (error) {
    console.error('[API Notifications GET] Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
} 