export const rabbitmqConfig = {
  url: process.env.RABBITMQ_URL || 'amqp://localhost',
  
  // Exchanges
  eventsExchange: 'events_exchange', // For domain events (topic type recommended)
  questProgressExchange: 'quest_progress_exchange', // For broadcasting quest progress (fanout type)
  deadLetterExchange: 'dead_letter_exchange', // DLX for failed messages (direct or topic type)

  // --- Queues (consumers will declare and bind these) ---
  // Quest Engine Service
  questContributionQueue: 'quest_contribution_processing_queue',
  questContributionDLQ: 'quest_contribution_processing_dlq', // Dead Letter Queue for quest contributions
  
  // Reward Distribution Service
  rewardDistributionQueue: 'reward_distribution_queue',
  rewardDistributionDLQ: 'reward_distribution_dlq', // Dead Letter Queue for reward distribution

  // --- Routing Keys for eventsExchange ---
  routingKeys: {
    userReferredSuccess: 'user.referred.success',
    userTierUpdated: 'user.tier.updated',
    userSpendRecorded: 'user.spend.recorded', // New event for user spending
    // publish reward distribution triggers to eventsExchange with rewardDistributionQueue name as routing key
    // This allows RewardDistributionService to bind its queue to eventsExchange with this specific key.
  },
  
  // Routing key for quest progress updates (published to questProgressExchange)
  questProgressChanged: 'quest.progress.changed',

  // Routing key for messages going into DLQs (can be specific per DLQ or more generic)
  // Often, the original routing key might be used, or a specific one for the DLQ itself.
  // For simplicity, we can use the DLQ name as its routing key if DLX is a direct exchange.
  dlqRoutingKeyPrefix: 'dlq.'
}; 