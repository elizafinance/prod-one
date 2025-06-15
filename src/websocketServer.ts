import { createServer } from 'http';
import { Server } from 'socket.io';

// Adjust paths assuming .js extension for a standalone Node server
import { rabbitmqService } from './services/rabbitmq.service.js'; 
import { rabbitmqConfig } from './config/rabbitmq.config.js';

const WEBSOCKET_PORT = parseInt(process.env.WEBSOCKET_PORT || '3001', 10);
const FRONTEND_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'; // URL of your Next.js app

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    // credentials: true // If you need to handle cookies/auth with websockets
  },
  // path: '/ws' // Optional: if you want to serve websockets under a specific path
});

io.on('connection', (socket) => {
  console.log(`[WebSocket] User connected: ${socket.id}`);

  // Example: joining a room (can be used later for targeted updates)
  // socket.join('all_quests_updates');

  socket.on('disconnect', (reason) => {
    console.log(`[WebSocket] User disconnected: ${socket.id}, reason: ${reason}`);
  });

  // Example: handling a custom event from client (not immediately needed for progress push)
  // socket.on('client_event', (data) => {
  //   console.log(`[WebSocket] Received client_event from ${socket.id}:`, data);
  //   // Broadcast or emit back
  //   socket.emit('server_response', { received: data });
  // });
});

async function setupRabbitMQConsumerForWebSockets() {
  console.log('[WebSocket/RabbitMQ] Initializing RabbitMQ consumer for quest progress...');
  try {
    const channel = await rabbitmqService.getChannel(); // Assumes connect() was called in startServer

    // Assert the fanout exchange (QuestEngineService should also assert this when publishing)
    await channel.assertExchange(rabbitmqConfig.questProgressExchange, 'fanout', { durable: true });

    // Create an exclusive, non-durable queue for this WebSocket server instance.
    // The queue will be deleted when the connection closes.
    const q = await channel.assertQueue('', { exclusive: true, durable: false });
    console.log(`[WebSocket/RabbitMQ] Declared exclusive queue: ${q.queue}`);

    // Bind the exclusive queue to the fanout exchange
    // The routing key ('') is ignored for fanout exchanges.
    await channel.bindQueue(q.queue, rabbitmqConfig.questProgressExchange, '');
    console.log(`[WebSocket/RabbitMQ] Bound queue ${q.queue} to exchange ${rabbitmqConfig.questProgressExchange}`);

    // Start consuming messages
    channel.consume(q.queue, (msg) => {
      if (msg && msg.content) {
        try {
          const progressData = JSON.parse(msg.content.toString());
          console.log('[WebSocket/RabbitMQ] Received quest progress update:', progressData);
          
          // Broadcast the update to all connected WebSocket clients
          io.emit('quest_progress_update', progressData);
          // channel.ack(msg); // Not strictly needed for fanout with auto-ack queues or if processing is quick
        } catch (parseError) {
          console.error('[WebSocket/RabbitMQ] Error parsing progress update message:', parseError);
          // channel.nack(msg, false, false); // Or ack to discard unparseable message
        }
      }
    }, { noAck: true }); // Using noAck: true for simplicity with fanout; for critical tasks, manual ack is safer.

    console.log('[WebSocket/RabbitMQ] Consumer started. Waiting for quest progress updates...');

  } catch (error) {
    console.error('[WebSocket/RabbitMQ] Failed to setup RabbitMQ consumer:', error);
    throw error; // Propagate error to stop server startup if consumer setup fails
  }
}

async function startServer() {
  try {
    await rabbitmqService.connect(); // Ensure RabbitMQ connection for the consumer part
    console.log('[WebSocket] RabbitMQ connected for WebSocket server.');
    await setupRabbitMQConsumerForWebSockets(); // Call this after RabbitMQ is connected

    httpServer.listen(WEBSOCKET_PORT, () => {
      console.log(`[WebSocket] Server listening on port ${WEBSOCKET_PORT}`);
      console.log(`[WebSocket] Allowing connections from origin: ${FRONTEND_URL}`);
    });
  } catch (error) {
    console.error('[WebSocket] Failed to start server or RabbitMQ consumer:', error);
    process.exit(1);
  }
}

startServer(); 