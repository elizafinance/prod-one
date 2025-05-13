import { NextResponse } from 'next/server';
import { connectToDatabase, NotificationDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated or wallet not linked' }, { status: 401 });
  }
  const userWalletAddress = session.user.walletAddress;

  try {
    const { db } = await connectToDatabase();
    const notificationsCollection = db.collection<NotificationDocument>('notifications');

    const result = await notificationsCollection.updateMany(
      {
        recipientWalletAddress: userWalletAddress,
        isRead: false // Only update unread notifications
      },
      { $set: { isRead: true, updatedAt: new Date() } }
    );

    return NextResponse.json({ message: `Successfully marked ${result.modifiedCount} notifications as read.` });

  } catch (error) {
    console.error('[API Notifications MarkAllRead POST] Error:', error);
    return NextResponse.json({ error: 'Failed to mark all notifications as read' }, { status: 500 });
  }
} 