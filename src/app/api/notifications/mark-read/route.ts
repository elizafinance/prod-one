import { NextResponse } from 'next/server';
import { connectToDatabase, NotificationDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

interface MarkReadRequestBody {
  notificationIds: string[]; // An array of notification IDs to mark as read
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const currentUserWalletAddress = session.user.walletAddress;

  try {
    const body: MarkReadRequestBody = await request.json();
    const { notificationIds } = body;

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json({ error: 'notificationIds array is required and cannot be empty.' }, { status: 400 });
    }

    // Optional: Validate that all IDs are strings, etc.
    for (const id of notificationIds) {
      if (typeof id !== 'string') {
        return NextResponse.json({ error: 'All notificationIds must be strings.' }, { status: 400 });
      }
    }

    const { db } = await connectToDatabase();
    const notificationsCollection = db.collection<NotificationDocument>('notifications');

    const result = await notificationsCollection.updateMany(
      {
        recipientWalletAddress: currentUserWalletAddress,
        notificationId: { $in: notificationIds },
        isRead: false // Only update those that are currently unread
      },
      { $set: { isRead: true, updatedAt: new Date() } } // Add updatedAt for tracking
    );

    return NextResponse.json({ 
      message: 'Notifications marked as read successfully.', 
      updatedCount: result.modifiedCount 
    });

  } catch (error) {
    console.error("Error marking notifications as read:", error);
    if (error instanceof SyntaxError) { // Handle cases where request.json() fails
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 });
  }
} 