import { rabbitmqService } from './services/rabbitmq.service';
import { questEngineService } from './modules/quest-engine/questEngine.service';
import { redisService } from './services/redis.service';
import { rewardDistributorService } from './modules/reward-distributor/rewardDistributor.service';

async function startWorker() {
  console.log('[Worker] Starting background worker process...');
  try {
    // Initialize connections
    await Promise.all([
      rabbitmqService.connect(), 
      redisService.connect()
    ]);
    console.log('[Worker] RabbitMQ and Redis connections established by worker.');

    // Start the consumer services
    // These functions will run indefinitely
    await Promise.all([
        questEngineService.start(),
        rewardDistributorService.start()
    ]);
    
    console.log('[Worker] All consumer services started and processing messages.');

  } catch (error) {
    console.error('[Worker] Failed to start worker process (or connect to services):', error);
    // Optionally, implement a more sophisticated shutdown or retry mechanism here
    process.exit(1); // Exit if critical services can't start
  }
}

// Handle graceful shutdown
function gracefulShutdown(signal) {
  console.log(`[Worker] Received ${signal}. Shutting down gracefully...`);
  const shutdownPromises = [];

  const rabbitChannelPromise = rabbitmqService.getChannel().then(channel => {
    if (channel && channel.connection) {
      console.log('[Worker] Closing RabbitMQ connection...');
      return channel.connection.close();
    }
    return Promise.resolve();
  }).catch(err => {
    console.error('[Worker] Error during RabbitMQ connection close:', err);
    return Promise.resolve(); // Don't let RabbitMQ error prevent Redis from closing
  });
  shutdownPromises.push(rabbitChannelPromise);

  const redisClientPromise = redisService.getClient().then(client => {
    if (client && client.status === 'ready') {
      console.log('[Worker] Closing Redis connection...');
      return client.quit(); // Use quit() for graceful shutdown with ioredis
    }
    return Promise.resolve();
  }).catch(err => {
    console.error('[Worker] Error during Redis connection close:', err);
    return Promise.resolve();
  });
  shutdownPromises.push(redisClientPromise);

  Promise.all(shutdownPromises).then(() => {
    console.log('[Worker] All connections closed. Exiting.');
    process.exit(0);
  }).catch(err => {
    console.error('[Worker] Error during graceful shutdown sequence:', err);
    process.exit(1);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startWorker(); 