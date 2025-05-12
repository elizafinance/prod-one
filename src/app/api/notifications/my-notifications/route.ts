import { NextResponse } from 'next/server';
import { connectToDatabase, NotificationDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const currentUserWalletAddress = session.user.walletAddress;

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20'); // Default to 20 notifications
  const onlyUnread = searchParams.get('unread') === 'true';

  try {
    const { db } = await connectToDatabase();
    const notificationsCollection = db.collection<NotificationDocument>('notifications');

    const query: any = { recipientWalletAddress: currentUserWalletAddress };
    if (onlyUnread) {
      query.isRead = false;
    }

    const notifications = await notificationsCollection
      .find(query)
      .sort({ createdAt: -1 }) // Newest first
      .limit(Math.max(1, Math.min(limit, 100))) // Ensure limit is reasonable (1-100)
      .toArray();

    // Always get the total unread count for the user if they are fetching their notifications
    const totalUnreadCount = await notificationsCollection.countDocuments({
        recipientWalletAddress: currentUserWalletAddress,
        isRead: false
    });

    return NextResponse.json({ 
        notifications,
        unreadCount: totalUnreadCount // Always return the true total unread count
    });

  } catch (error) {
    console.error("Error fetching user notifications:", error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// It might also be useful to have a POST endpoint to mark notifications as read
// e.g., POST /api/notifications/mark-read with body { notificationIds: ["id1", "id2"] } 