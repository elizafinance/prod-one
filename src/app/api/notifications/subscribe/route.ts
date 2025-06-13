import { NextRequest } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase, NotificationDocument } from '@/lib/mongodb';
import { ChangeStream } from 'mongodb';

const SSE_HEARTBEAT_INTERVAL = 15000; // 15 seconds for heartbeat

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions) as any;

  if (!session || !session.user || !session.user.walletAddress) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userWalletAddress = session.user.walletAddress;

  const stream = new ReadableStream({
    async start(controller) {
      const { db } = await connectToDatabase();
      const notificationsCollection = db.collection<NotificationDocument>('notifications');

      let changeStream: ChangeStream | null = null;

      const sendEvent = (data: object) => {
        try {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        } catch (e) {
          console.error("[SSE Stream] Error enqueuing data:", e);
        }
      };
      
      const sendUnreadCount = async () => {
        try {
          const count = await notificationsCollection.countDocuments({
            recipientWalletAddress: userWalletAddress,
            isRead: false
          });
          sendEvent({ type: 'unread_count_update', count });
        } catch (error) {
          console.error('[SSE Change Stream] Error fetching initial unread count:', error);
        }
      };

      // 1. Send the initial count immediately on connection
      await sendUnreadCount();

      // 2. Define a pipeline to watch for relevant changes
      const pipeline = [
        {
          // We only care about operations affecting the logged-in user.
          // This filter works for inserts and updates where fullDocument is available.
          // For deletes, we might need a broader listener if user-specific deletes are frequent.
          // For now, this covers the most common cases: new notifs and marking as read.
          $match: {
            'fullDocument.recipientWalletAddress': userWalletAddress
          }
        }
      ];

      // 3. Open the change stream
      changeStream = notificationsCollection.watch(pipeline, { fullDocument: 'updateLookup' });
      console.log(`[SSE Change Stream] Opened for user ${userWalletAddress}`);

      // 4. Listen for changes and trigger a recount
      changeStream.on('change', (change) => {
        console.log(`[SSE Change Stream] Change detected for ${userWalletAddress}, type: ${change.operationType}. Triggering recount.`);
        sendUnreadCount();
      });
      
      changeStream.on('error', (error) => {
          console.error(`[SSE Change Stream] Error for user ${userWalletAddress}:`, error);
          // Consider closing the stream if the error is fatal
      });

      // 5. Heartbeat to keep the connection alive
      const heartbeatIntervalId = setInterval(() => {
        sendEvent({ type: 'heartbeat', timestamp: Date.now() });
      }, SSE_HEARTBEAT_INTERVAL);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE Change Stream] Client disconnected for ${userWalletAddress}. Closing stream.`);
        clearInterval(heartbeatIntervalId);
        if (changeStream) {
          changeStream.close();
        }
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
    }
  });
} 