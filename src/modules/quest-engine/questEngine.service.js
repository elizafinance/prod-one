import { rabbitmqService } from '../../services/rabbitmq.service';
import { rabbitmqConfig } from '../../config/rabbitmq.config';
import { redisService } from '../../services/redis.service';
import { redisConfig } from '../../config/redis.config';
import CommunityQuest from '../../models/communityQuest.model';
import QuestContribution from '../../models/questContribution.model';
// import QuestRewardLedger from '../../models/questRewardLedger.model'; // For later reward distribution

const MAX_RETRIES = 3;

async function handleUserReferredEvent(message) {
  console.log(`[QuestEngine/Referral] Received user.referred.success event:`, message);
  const { userId, referredByUserId, timestamp } = message;
  if (!referredByUserId || !userId) {
    console.error('[QuestEngine/Referral] Invalid message payload for user.referred.success', message);
    return { success: true, retryable: false }; 
  }
  try {
    const activeReferralQuests = await CommunityQuest.find({
      status: 'active', goal_type: 'total_referrals', start_ts: { $lte: new Date(timestamp) }, end_ts: { $gte: new Date(timestamp) },
    }).lean();
    if (!activeReferralQuests.length) return { success: true, retryable: false };
    for (const quest of activeReferralQuests) {
      console.log(`[QuestEngine/Referral] Processing quest ${quest.title} (${quest._id}) for referral by ${referredByUserId}`);
      await QuestContribution.findOneAndUpdate(
        { quest_id: quest._id, user_id: referredByUserId }, 
        { $inc: { metric_value: 1 } }, 
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      const progressResult = await QuestContribution.aggregate([
        { $match: { quest_id: quest._id } },
        { $group: { _id: null, total: { $sum: '$metric_value' } } }
      ]);
      const currentTotalProgress = progressResult.length > 0 ? progressResult[0].total : 0;
      console.log(`[QuestEngine/Referral] Quest ${quest._id} current total progress: ${currentTotalProgress} / ${quest.goal_target}`);
      const questProgressKey = `${redisConfig.defaultQuestProgressKeyPrefix}${quest._id}`;
      await redisService.set(questProgressKey, { current: currentTotalProgress, goal: quest.goal_target, updated_at: new Date().toISOString() });
      await rabbitmqService.publishToExchange(rabbitmqConfig.questProgressExchange, rabbitmqConfig.questProgressChanged, 
        { questId: quest._id.toString(), questTitle: quest.title, currentProgress: currentTotalProgress, goalTarget: quest.goal_target, lastContributorWalletAddress: referredByUserId, updatedAt: new Date().toISOString() }
      );
      if (currentTotalProgress >= quest.goal_target && quest.status !== 'succeeded' && quest.status !== 'failed') {
        const updatedQuest = await CommunityQuest.findOneAndUpdate(
          { _id: quest._id, status: 'active' }, { $set: { status: 'succeeded', updatedAt: new Date() } }, { new: true }
        );
        if (updatedQuest) {
          console.log(`[QuestEngine/Referral] Quest ${quest._id} status updated to 'succeeded'. Enqueuing for reward distribution.`);
          await rabbitmqService.publishToExchange(rabbitmqConfig.eventsExchange, rabbitmqConfig.rewardDistributionQueue,
            { questId: quest._id.toString(), questTitle: quest.title, completedAt: new Date().toISOString() }
          );
        }
      }
    }
    return { success: true, retryable: false };
  } catch (error) {
    console.error('[QuestEngine/Referral] Error processing user.referred.success:', error);
    const retryable = error.name === 'MongoNetworkError' || error.name === 'RedisError';
    return { success: false, retryable };
  }
}

async function handleUserTierUpdateEvent(message) {
  console.log(`[QuestEngine/TierUpdate] Received user.tier.updated event:`, message);
  const { userId, newTier, timestamp } = message;

  if (!userId || !newTier) {
    console.error('[QuestEngine/TierUpdate] Invalid message payload for user.tier.updated', message);
    return { success: true, retryable: false };
  }

  try {
    const activeTierQuests = await CommunityQuest.find({
      status: 'active',
      goal_type: 'users_at_tier',
      start_ts: { $lte: new Date(timestamp) },
      end_ts: { $gte: new Date(timestamp) }, 
    }).lean();

    if (!activeTierQuests.length) {
      // console.log('[QuestEngine/TierUpdate] No active tier quests for this event.');
      return { success: true, retryable: false };
    }

    for (const quest of activeTierQuests) {
      // Check if the quest's target tier matches the user's new tier
      const targetTierName = quest.goal_target_metadata?.tier_name;
      if (!targetTierName) {
        console.warn(`[QuestEngine/TierUpdate] Quest ${quest._id} is type 'users_at_tier' but missing target_tier_name in metadata. Skipping.`);
        continue;
      }

      if (newTier.toLowerCase() === targetTierName.toLowerCase()) {
        console.log(`[QuestEngine/TierUpdate] User ${userId} reached target tier ${targetTierName} for quest ${quest.title} (${quest._id})`);
        // For 'users_at_tier' quests, we count distinct users who reach the tier.
        // Contribution metric_value: 1 signifies they met the criteria *once* during the quest.
        // This assumes we want to count unique users reaching the tier, not how many times they fluctuate.
        await QuestContribution.findOneAndUpdate(
          { quest_id: quest._id, user_id: userId },
          { $setOnInsert: { metric_value: 1, created_ts: new Date() } }, // Set metric_value to 1 only on insert
                                                                     // If they drop and regain, they are still counted once.
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`[QuestEngine/TierUpdate] Contribution recorded/verified for user ${userId} in quest ${quest._id}. metric_value: 1`);
        
        // Recalculate progress: count of distinct users who met the tier criteria for this quest
        // (i.e. have a QuestContribution with metric_value >= 1 for this quest)
        const progressResult = await QuestContribution.countDocuments({
          quest_id: quest._id,
          metric_value: { $gte: 1 } // Count users who have at least 1 (meaning they hit the tier)
        });
        const currentTotalProgress = progressResult; // This is a count of users
        console.log(`[QuestEngine/TierUpdate] Quest ${quest._id} current total progress: ${currentTotalProgress} users / ${quest.goal_target} users`);

        const questProgressKey = `${redisConfig.defaultQuestProgressKeyPrefix}${quest._id}`;
        await redisService.set(questProgressKey, { 
          current: currentTotalProgress, 
          goal: quest.goal_target, 
          updated_at: new Date().toISOString() 
        });
        console.log(`[QuestEngine/TierUpdate] Quest ${quest._id} progress cached in Redis.`);

        await rabbitmqService.publishToExchange(
          rabbitmqConfig.questProgressExchange,
          rabbitmqConfig.questProgressChanged,
          { 
            questId: quest._id.toString(), 
            questTitle: quest.title,
            currentProgress: currentTotalProgress, 
            goalTarget: quest.goal_target, 
            lastContributorWalletAddress: userId, // The user who triggered this progress update
            updatedAt: new Date().toISOString()
          }
        );
        console.log(`[QuestEngine/TierUpdate] Published quest.progress.changed event for quest ${quest._id}`);

        if (currentTotalProgress >= quest.goal_target && quest.status !== 'succeeded' && quest.status !== 'failed') {
          console.log(`[QuestEngine/TierUpdate] Quest ${quest._id} COMPLETED!`);
          const updatedQuest = await CommunityQuest.findOneAndUpdate(
            { _id: quest._id, status: 'active' },
            { $set: { status: 'succeeded', updatedAt: new Date() } },
            { new: true }
          );
          if (updatedQuest) {
            console.log(`[QuestEngine/TierUpdate] Quest ${quest._id} status updated to 'succeeded'. Enqueuing for reward distribution.`);
            await rabbitmqService.publishToExchange(
              rabbitmqConfig.eventsExchange,
              rabbitmqConfig.rewardDistributionQueue,
              { questId: quest._id.toString(), questTitle: quest.title, completedAt: new Date().toISOString() }
            );
          }
        }
      } else {
        // console.log(`[QuestEngine/TierUpdate] User ${userId} new tier ${newTier} does not match quest ${quest._id} target ${targetTierName}`);
        // If a user *drops* from a tier, their QuestContribution remains (metric_value:1).
        // The quest only cares that they *reached* it at some point during the quest period.
        // If the requirement was to *maintain* the tier, the logic would be more complex.
      }
    }
    return { success: true, retryable: false };
  } catch (error) {
    console.error('[QuestEngine/TierUpdate] Error processing user.tier.updated:', error);
    const retryable = error.name === 'MongoNetworkError' || error.name === 'RedisError';
    return { success: false, retryable };
  }
}

async function handleUserSpendEvent(message) {
  console.log(`[QuestEngine/Spend] Received user.spend.recorded event:`, message);
  const { userId, amountSpent, currency, timestamp } = message;

  if (!userId || typeof amountSpent !== 'number' || amountSpent <= 0) {
    console.error('[QuestEngine/Spend] Invalid message payload for user.spend.recorded', message);
    return { success: true, retryable: false }; // ACK invalid message
  }

  try {
    const activeSpendQuests = await CommunityQuest.find({
      status: 'active',
      goal_type: 'aggregate_spend',
      start_ts: { $lte: new Date(timestamp) },
      end_ts: { $gte: new Date(timestamp) },
    }).lean();

    if (!activeSpendQuests.length) return { success: true, retryable: false };

    for (const quest of activeSpendQuests) {
      // Optional: Filter by currency if specified in quest metadata
      const targetCurrency = quest.goal_target_metadata?.currency;
      if (targetCurrency && currency && targetCurrency.toLowerCase() !== currency.toLowerCase()) {
        console.log(`[QuestEngine/Spend] Quest ${quest._id} targets currency ${targetCurrency}, event is for ${currency}. Skipping.`);
        continue;
      }

      console.log(`[QuestEngine/Spend] Processing quest ${quest.title} (${quest._id}) for spend by ${userId} of ${amountSpent}`);
      await QuestContribution.findOneAndUpdate(
        { quest_id: quest._id, user_id: userId },
        { $inc: { metric_value: amountSpent } }, // Increment contribution by the amount spent
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Recalculate overall quest progress (sum of all spend contributions for this quest)
      const progressResult = await QuestContribution.aggregate([
        { $match: { quest_id: quest._id } },
        { $group: { _id: null, total: { $sum: '$metric_value' } } }
      ]);
      const currentTotalProgress = progressResult.length > 0 ? progressResult[0].total : 0;
      console.log(`[QuestEngine/Spend] Quest ${quest._id} current total progress: ${currentTotalProgress} / ${quest.goal_target}`);

      const questProgressKey = `${redisConfig.defaultQuestProgressKeyPrefix}${quest._id}`;
      await redisService.set(questProgressKey, { 
        current: currentTotalProgress, 
        goal: quest.goal_target, 
        updated_at: new Date().toISOString() 
      });

      await rabbitmqService.publishToExchange(
        rabbitmqConfig.questProgressExchange,
        rabbitmqConfig.questProgressChanged,
        { 
          questId: quest._id.toString(), 
          questTitle: quest.title,
          currentProgress: currentTotalProgress, 
          goalTarget: quest.goal_target, 
          lastContributorWalletAddress: userId, 
          updatedAt: new Date().toISOString()
        }
      );

      if (currentTotalProgress >= quest.goal_target && quest.status !== 'succeeded' && quest.status !== 'failed') {
        const updatedQuest = await CommunityQuest.findOneAndUpdate(
          { _id: quest._id, status: 'active' },
          { $set: { status: 'succeeded', updatedAt: new Date() } },
          { new: true }
        );
        if (updatedQuest) {
          console.log(`[QuestEngine/Spend] Quest ${quest._id} COMPLETED! Enqueuing for reward distribution.`);
          await rabbitmqService.publishToExchange(
            rabbitmqConfig.eventsExchange,
            rabbitmqConfig.rewardDistributionQueue,
            { questId: quest._id.toString(), questTitle: quest.title, completedAt: new Date().toISOString() }
          );
        }
      }
    }
    return { success: true, retryable: false };
  } catch (error) {
    console.error('[QuestEngine/Spend] Error processing user.spend.recorded:', error);
    const retryable = error.name === 'MongoNetworkError' || error.name === 'RedisError';
    return { success: false, retryable };
  }
}

async function consumeQuestEvents() {
  try {
    const channel = await rabbitmqService.getChannel();
    const queueName = rabbitmqConfig.questContributionQueue;
    const dlxName = rabbitmqConfig.deadLetterExchange;
    const dlqName = rabbitmqConfig.questContributionDLQ;
    // Use a specific routing key for this DLQ, e.g., based on the original queue name
    const dlqRoutingKey = `${rabbitmqConfig.dlqRoutingKeyPrefix}${queueName}`;

    // 1. Assert Dead Letter Exchange (e.g., direct type)
    await channel.assertExchange(dlxName, 'direct', { durable: true });
    // 2. Assert Dead Letter Queue
    await channel.assertQueue(dlqName, { durable: true });
    // 3. Bind DLQ to DLX
    await channel.bindQueue(dlqName, dlxName, dlqRoutingKey);
    console.log(`[QuestEngine] DLX (${dlxName}) and DLQ (${dlqName}) setup complete. Bound with key: ${dlqRoutingKey}`);

    // 4. Assert main queue with DLX arguments
    await channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': dlxName,
        'x-dead-letter-routing-key': dlqRoutingKey
      }
    });
    console.log(`[QuestEngine] Queue '${queueName}' asserted with DLX routing to '${dlxName}' with key '${dlqRoutingKey}'.`);

    await channel.bindQueue(queueName, rabbitmqConfig.eventsExchange, rabbitmqConfig.routingKeys.userReferredSuccess);
    await channel.bindQueue(queueName, rabbitmqConfig.eventsExchange, rabbitmqConfig.routingKeys.userTierUpdated);
    await channel.bindQueue(queueName, rabbitmqConfig.eventsExchange, rabbitmqConfig.routingKeys.userSpendRecorded);
    console.log(`[QuestEngine] Bound to routing keys: ${rabbitmqConfig.routingKeys.userReferredSuccess}, ${rabbitmqConfig.routingKeys.userTierUpdated}, ${rabbitmqConfig.routingKeys.userSpendRecorded}`);

    await channel.assertQueue(rabbitmqConfig.rewardDistributionQueue, { durable: true }); // For publishing trigger
    console.log(`[QuestEngine] Reward distribution queue '${rabbitmqConfig.rewardDistributionQueue}' also asserted.`);

    channel.consume(queueName, async (msg) => {
      if (msg !== null) {
        let messageContent;
        try {
          messageContent = JSON.parse(msg.content.toString());
        } catch (parseError) {
          console.error('[QuestEngine] Failed to parse message content. Discarding (ACKing):', parseError, msg.content.toString());
          channel.ack(msg); 
          return;
        }

        let attempt = (msg.properties.headers && msg.properties.headers['x-retries']) || 0;
        let handlerResult = { success: false, retryable: false };

        try {
          const routingKey = msg.fields.routingKey;
          console.log(`[QuestEngine] Received message with routing key: ${routingKey}, attempt: ${attempt}`);
          if (routingKey === rabbitmqConfig.routingKeys.userReferredSuccess) {
            handlerResult = await handleUserReferredEvent(messageContent);
          } else if (routingKey === rabbitmqConfig.routingKeys.userTierUpdated) {
            handlerResult = await handleUserTierUpdateEvent(messageContent);
          } else if (routingKey === rabbitmqConfig.routingKeys.userSpendRecorded) {
            handlerResult = await handleUserSpendEvent(messageContent);
          } else {
            console.warn(`[QuestEngine] Received message with unhandled routing key: ${routingKey}. Discarding (ACKing).`);
            handlerResult = { success: true, retryable: false }; 
          }
        } catch (processingError) {
          console.error('[QuestEngine] Uncaught error during message processing logic:', processingError);
          // Treat uncaught errors as potentially non-retryable to avoid loops, or decide based on error type
          handlerResult = { success: false, retryable: false }; 
        }

        if (handlerResult.success) {
          channel.ack(msg);
        } else {
          attempt++;
          if (attempt <= MAX_RETRIES && handlerResult.retryable) {
            console.log(`[QuestEngine] NACKing message for retry (attempt ${attempt}/${MAX_RETRIES}). Message:`, messageContent);
            // Update retry count in headers if re-publishing to a delay queue. 
            // For nack(requeue=true), RabbitMQ handles redelivery but not retry count directly in headers for this.
            // For simplicity with DLX, we rely on nack(requeue=true) for limited retries on original queue.
            // If a message keeps failing, it will eventually be DLQ'd by RabbitMQ if it supports max-length-bytes or similar, 
            // or if our consumer nacks it without requeue after enough attempts. 
            // A more robust retry with delay would involve an intermediate retry queue.
            // For now, we requeue. If it fails MAX_RETRIES times due to retryable=true, then it will be DLQ'd on the next failure where retryable=false or attempt > MAX_RETRIES.
            channel.nack(msg, false, true); // Requeue for another attempt by this or another consumer instance
          } else {
            console.error(`[QuestEngine] Message processing failed after ${attempt-1} attempts or was non-retryable. Sending to DLQ. Message:`, messageContent);
            channel.nack(msg, false, false); // Send to DLX (and then to DLQ)
          }
        }
      }
    });
  } catch (error) {
    console.error('[QuestEngine] Failed to start consumer:', error);
    process.exit(1); 
  }
}

export const questEngineService = {
  start: consumeQuestEvents,
  // Potentially add other methods like manually triggering quest checks, etc.
}; 