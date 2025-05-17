import { NextResponse } from 'next/server';
import { connectToDatabase, NotificationDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

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

    const userNotifications = await notificationsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const unreadCount = await notificationsCollection.countDocuments({
        ...query,
        isRead: false
    });

    return NextResponse.json({
      notifications: userNotifications,
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