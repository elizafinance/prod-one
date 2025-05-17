import { NextResponse } from 'next/server';
import { connectToDatabase, NotificationDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
// import { ObjectId } from 'mongodb'; // Not strictly needed if using notificationId (string) for query

interface RouteContext {
  params: {
    notificationId: string; // This is our custom UUID string notificationId
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions) as any;
  const { notificationId } = params;

  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated or wallet not linked' }, { status: 401 });
  }
  const userWalletAddress = session.user.walletAddress;

  if (!notificationId) {
    return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const notificationsCollection = db.collection<NotificationDocument>('notifications');

    const result = await notificationsCollection.updateOne(
      {
        notificationId: notificationId,
        recipientWalletAddress: userWalletAddress // Ensure user can only mark their own notifications
      },
      { $set: { isRead: true, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'Notification not found or not owned by user' }, { status: 404 });
    }
    if (result.modifiedCount === 0) {
        return NextResponse.json({ message: 'Notification was already marked as read' }, { status: 200 });
    }

    return NextResponse.json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error(`[API Notifications PUT /${notificationId}/read] Error marking notification as read:`, error);
    return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 });
  }
} 