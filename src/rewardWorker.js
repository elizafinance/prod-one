import './config/env-loader.js';

import { rabbitmqService } from './services/rabbitmq.service.js';
import { rewardDistributorService } from './modules/reward-distributor/rewardDistributor.service.js';

async function startRewardWorker() {
  console.log('[RewardWorker] Starting reward distributor worker process...');
  try {
    // Initialize RabbitMQ connection
    await rabbitmqService.connect();
    console.log('[RewardWorker] RabbitMQ connection established.');

    // Start the reward distributor service
    await rewardDistributorService.start();
    
    console.log('[RewardWorker] Reward distributor service started and processing messages.');

  } catch (error) {
    console.error('[RewardWorker] Failed to start reward worker process:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
function gracefulShutdown(signal) {
  console.log(`[RewardWorker] Received ${signal}. Shutting down gracefully...`);
  
  rabbitmqService.getChannel().then(channel => {
    if (channel && channel.connection) {
      console.log('[RewardWorker] Closing RabbitMQ connection...');
      return channel.connection.close();
    }
    return Promise.resolve();
  }).then(() => {
    console.log('[RewardWorker] Connection closed. Exiting.');
    process.exit(0);
  }).catch(err => {
    console.error('[RewardWorker] Error during graceful shutdown:', err);
    process.exit(1);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

startRewardWorker(); 