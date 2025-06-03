import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from '@/lib/mongodb';
import { createNotification } from '@/lib/notificationUtils';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions) as any;

  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated or wallet not linked' }, { status: 401 });
  }
  const userWalletAddress = session.user.walletAddress;
  // const userIdForNotification = session.user.dbId || userWalletAddress; // createNotification uses walletAddress

  try {
    const { db } = await connectToDatabase();
    
    const notificationTitle = "🔔 Test Notification!";
    const notificationMessage = "This is a test notification sent from the dashboard at " + new Date().toLocaleTimeString();
    const ctaUrl = "/notifications"; // Link to the notifications page

    await createNotification(
      db,
      userWalletAddress, // recipientWalletAddress for createNotification utility
      'generic', // type
      notificationTitle,
      notificationMessage,
      ctaUrl
      // No other related IDs needed for a simple test notification
    );

    return NextResponse.json({ message: 'Test notification sent successfully!' });
  } catch (error) {
    console.error('[API TestNotification POST] Error:', error);
    return NextResponse.json({ error: 'Failed to send test notification' }, { status: 500 });
  }
} 