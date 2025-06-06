import { NextResponse } from 'next/server';
import { connectToDatabase, NotificationDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

interface MarkReadRequestBody {
  notificationIds: string[]; // An array of notification IDs to mark as read
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions) as any;
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    console.warn('[Notifications Mark-Read] User not authenticated or wallet not available in session when trying to mark read');
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const currentUserWalletAddress = session.user.walletAddress;
  // <<< PRIMARY LOGGING FOR WALLET ADDRESS USED IN QUERY >>>
  console.log(`[Notifications Mark-Read] Wallet address from session being used for DB query: ${currentUserWalletAddress}`);

  try {
    const body: MarkReadRequestBody = await request.json();
    const { notificationIds } = body;

    // <<< MOVE/ADD LOGGING FOR session.user.walletAddress AND notificationIds HERE >>>
    console.log(`[Notifications Mark-Read] Session wallet for query: ${currentUserWalletAddress}, Received Notification IDs from client:`, notificationIds);

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json({ error: 'notificationIds array is required and cannot be empty.' }, { status: 400 });
    }

    // Optional: Validate that all IDs are strings, etc.
    for (const id of notificationIds) {
      if (typeof id !== 'string') {
        return NextResponse.json({ error: 'All notificationIds must be strings.' }, { status: 400 });
      }
    }

    console.log(`[Notifications] Marking as read: ${notificationIds.join(', ')} for ${currentUserWalletAddress}`);

    const { db } = await connectToDatabase();
    const notificationsCollection = db.collection<NotificationDocument>('notifications');

    // --- BEGIN DIAGNOSTIC LOGGING ---
    if (notificationIds && notificationIds.length > 0) {
      const diagnosticDocs = await notificationsCollection.find({
        recipientWalletAddress: currentUserWalletAddress,
        notificationId: { $in: notificationIds }
      }).project({ notificationId: 1, isRead: 1, type: 1, title:1 }).toArray();
      console.log(`[Notifications Mark-Read DIAGNOSTIC] Docs found for IDs [${notificationIds.join(', ')}]:`, JSON.stringify(diagnosticDocs, null, 2));
    }
    // --- END DIAGNOSTIC LOGGING ---

    const result = await notificationsCollection.updateMany(
      {
        recipientWalletAddress: currentUserWalletAddress,
        notificationId: { $in: notificationIds },
        isRead: false // Only update those that are currently unread
      },
      { $set: { isRead: true, updatedAt: new Date() } } // Add updatedAt for tracking
    );

    console.log(`[Notifications] Marked ${result.modifiedCount} notifications as read using notificationId`);

    return NextResponse.json({ 
      message: 'Notifications marked as read successfully.', 
      updatedCount: result.modifiedCount 
    });

  } catch (error) {
    console.error("[Notifications] Error marking notifications as read:", error);
    if (error instanceof SyntaxError) { // Handle cases where request.json() fails
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 });
  }
} 