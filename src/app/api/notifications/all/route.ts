import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase, NotificationDocument } from '@/lib/mongodb';

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions) as any;

  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated or wallet not linked' }, { status: 401 });
  }
  const userWalletAddress = session.user.walletAddress;

  try {
    const { db } = await connectToDatabase();
    const notificationsCollection = db.collection<NotificationDocument>('notifications');

    const deleteResult = await notificationsCollection.deleteMany({
      recipientWalletAddress: userWalletAddress 
      // Note: This deletes ALL notifications for the user, regardless of type or read status.
      // If you need more specific clearing (e.g., only generic, only read), the query needs adjustment.
    });

    console.log(`[API Notifications DELETE ALL] Cleared ${deleteResult.deletedCount} notifications for user ${userWalletAddress}`);

    return NextResponse.json({ message: `Successfully cleared ${deleteResult.deletedCount} notifications.` });
  } catch (error) {
    console.error('[API Notifications DELETE ALL] Error:', error);
    return NextResponse.json({ error: 'Failed to clear notifications' }, { status: 500 });
  }
} 