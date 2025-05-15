export const rabbitmqConfig = {
  url: process.env.RABBITMQ_URL || 'amqp://localhost',
  
  // Exchanges
  eventsExchange: 'events_exchange', // Main exchange for various app events (topic type)
  questProgressExchange: 'quest_progress_exchange', // Exchange for quest progress updates (fanout type)
  deadLetterExchange: 'dead_letter_exchange', // DLX for handling failed messages (direct type)

  // --- Queues (consumers will declare and bind these) ---
  // Quest Engine Service
  questContributionQueue: 'quest_contribution_processing_queue', // For processing individual contributions/events that affect quests
  questContributionDLQ: 'quest_contribution_processing_queue_dlq',
  
  // Reward Distribution Service
  rewardDistributionQueue: 'reward_distribution_queue', // For triggering reward distribution for completed quests
  rewardDistributionDLQ: 'reward_distribution_queue_dlq',

  // --- Routing Keys for eventsExchange ---
  routingKeys: {
    userReferredSuccess: 'user.referred.success',       // payload: { userId, referredByUserId, timestamp, ... }
    userTierUpdated: 'user.tier.updated',             // payload: { userId, oldTier, newTier, timestamp, ... }
    userSpendRecorded: 'user.spend.recorded',         // payload: { userId, amountSpent, currency, timestamp, transactionId, ... }
    squadPointsUpdated: 'squad.points.updated',        // payload: { squadId, pointsChange, reason, timestamp, responsibleUserId (optional) ... }
    // Generic quest events (can be published by QuestLifecycleService or admin actions)
    questActivated: 'quest.lifecycle.activated',     // payload: { questId, activatedAt }
    questExpired: 'quest.lifecycle.expired',         // payload: { questId, expiredAt }
    questCompletedManually: 'quest.admin.completed', // payload: { questId, adminId, completedAt }
  },
  
  // Routing key for quest_progress_exchange (usually empty for fanout, but can be used if not fanout or for specific filtering by consumers if complex)
  questProgressChanged: 'quest.progress.changed', // payload: { questId, questTitle, currentProgress, goalTarget, lastContributorWalletAddress or squadId, scope ('community'|'squad'), updatedAt }

  // Routing key for messages going into DLQs (can be specific per DLQ or more generic)
  // Often, the original routing key might be used, or a specific one for the DLQ itself.
  // For simplicity, we can use the DLQ name as its routing key if DLX is a direct exchange.
  dlqRoutingKeyPrefix: 'dlq.routing.'
}; 