import { NextRequest } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase, NotificationDocument } from '@/lib/mongodb';

const SSE_HEARTBEAT_INTERVAL = 15000; // 15 seconds for heartbeat
const SSE_DATA_CHECK_INTERVAL = 5000;  // 5 seconds to check for new data

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions) as any;

  if (!session || !session.user || !session.user.walletAddress) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userWalletAddress = session.user.walletAddress;

  const stream = new ReadableStream({
    async start(controller) {
      let lastKnownUnreadCount = -1; // Initialize to a value that will trigger the first send
      let isCancelled = false;

      const sendEvent = (data: object) => {
        if (isCancelled) return;
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch (e) {
          console.error("[SSE Stream] Error enqueuing data:", e);
          // Potentially close stream if controller is broken
        }
      };

      const checkUnreadCount = async () => {
        if (isCancelled) return;
        try {
          const { db } = await connectToDatabase();
          const notificationsCollection = db.collection<NotificationDocument>('notifications');
          const currentUnreadCount = await notificationsCollection.countDocuments({
            recipientWalletAddress: userWalletAddress,
            isRead: false
          });

          if (currentUnreadCount !== lastKnownUnreadCount) {
            lastKnownUnreadCount = currentUnreadCount;
            sendEvent({ type: 'unread_count_update', count: currentUnreadCount });
          }
        } catch (error) {
          console.error('[SSE checkUnreadCount] Error fetching unread count:', error);
          // Optionally send an error event to client, or just log
        }
      };

      // Initial check
      await checkUnreadCount();

      // Periodic check for data
      const dataIntervalId = setInterval(checkUnreadCount, SSE_DATA_CHECK_INTERVAL);

      // Heartbeat to keep connection alive
      const heartbeatIntervalId = setInterval(() => {
        if (isCancelled) return;
        sendEvent({ type: 'heartbeat', timestamp: Date.now() });
      }, SSE_HEARTBEAT_INTERVAL);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE Stream] Client disconnected for ${userWalletAddress}`);
        isCancelled = true;
        clearInterval(dataIntervalId);
        clearInterval(heartbeatIntervalId);
        try {
          controller.close();
        } catch (e) {
            console.error("[SSE Stream] Error closing controller on abort:", e);
        }
      });

    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      // Optional: CORS headers if your client is on a different domain/port during dev
      // 'Access-Control-Allow-Origin': '*', 
    }
  });
} 