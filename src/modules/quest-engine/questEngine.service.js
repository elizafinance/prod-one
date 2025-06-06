import { rabbitmqService } from '../../services/rabbitmq.service.js';
import { rabbitmqConfig } from '../../config/rabbitmq.config.js';
import { redisService } from '../../services/redis.service.js';
import { redisConfig } from '../../config/redis.config.js';
import CommunityQuest from '../../models/communityQuest.model.js';
import QuestContribution from '../../models/questContribution.model.js';
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
      status: 'active',
      goal_type: 'total_referrals',
      scope: 'community', // Explicitly for community quests
      start_ts: { $lte: new Date(timestamp) },
      end_ts: { $gte: new Date(timestamp) },
    }).lean();

    if (!activeReferralQuests.length) return { success: true, retryable: false };

    for (const quest of activeReferralQuests) {
      console.log(`[QuestEngine/Referral] Processing quest ${quest.title} (${quest._id}) for referral by ${referredByUserId}`);
      await QuestContribution.findOneAndUpdate(
        { quest_id: quest._id, user_id: referredByUserId, squad_id: null }, // Ensure squad_id is null for community quests
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
        {
          questId: quest._id.toString(),
          questTitle: quest.title,
          currentProgress: currentTotalProgress,
          goalTarget: quest.goal_target,
          scope: quest.scope, // Add scope
          lastContributorWalletAddress: referredByUserId,
          updatedAt: new Date().toISOString()
        }
      );

      if (currentTotalProgress >= quest.goal_target && quest.status !== 'succeeded' && quest.status !== 'failed') {
        const updatedQuest = await CommunityQuest.findOneAndUpdate(
          { _id: quest._id, status: 'active' }, { $set: { status: 'succeeded', updatedAt: new Date() } }, { new: true }
        );
        if (updatedQuest) {
          console.log(`[QuestEngine/Referral] Quest ${quest._id} status updated to 'succeeded'. Enqueuing for reward distribution.`);
          await rabbitmqService.publishToExchange(rabbitmqConfig.eventsExchange, rabbitmqConfig.rewardDistributionQueue, // Use eventsExchange and specific routing key if reward queue is bound there
            { questId: quest._id.toString(), questTitle: quest.title, completedAt: new Date().toISOString(), scope: quest.scope }
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
      scope: 'community', // Explicitly for community quests
      start_ts: { $lte: new Date(timestamp) },
      end_ts: { $gte: new Date(timestamp) },
    }).lean();

    if (!activeTierQuests.length) {
      return { success: true, retryable: false };
    }

    for (const quest of activeTierQuests) {
      const targetTierName = quest.goal_target_metadata?.tier_name;
      if (!targetTierName) {
        console.warn(`[QuestEngine/TierUpdate] Quest ${quest._id} is type 'users_at_tier' but missing target_tier_name in metadata. Skipping.`);
        continue;
      }

      if (newTier.toLowerCase() === targetTierName.toLowerCase()) {
        console.log(`[QuestEngine/TierUpdate] User ${userId} reached target tier ${targetTierName} for quest ${quest.title} (${quest._id})`);
        await QuestContribution.findOneAndUpdate(
          { quest_id: quest._id, user_id: userId, squad_id: null }, // Ensure squad_id is null
          { $setOnInsert: { metric_value: 1, created_ts: new Date() } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        const progressResult = await QuestContribution.countDocuments({
          quest_id: quest._id,
          metric_value: { $gte: 1 }
        });
        const currentTotalProgress = progressResult;
        console.log(`[QuestEngine/TierUpdate] Quest ${quest._id} current total progress: ${currentTotalProgress} users / ${quest.goal_target} users`);

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
            scope: quest.scope, // Add scope
            lastContributorWalletAddress: userId,
            updatedAt: new Date().toISOString()
          }
        );

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
              rabbitmqConfig.eventsExchange, // Or direct to reward queue if not using eventsExchange for this
              rabbitmqConfig.rewardDistributionQueue, // Assuming this is a direct queue name or a routing key for events_exchange
              { questId: quest._id.toString(), questTitle: quest.title, completedAt: new Date().toISOString(), scope: quest.scope }
            );
          }
        }
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
    return { success: true, retryable: false };
  }

  try {
    const activeSpendQuests = await CommunityQuest.find({
      status: 'active',
      goal_type: 'aggregate_spend',
      scope: 'community', // Explicitly for community quests
      start_ts: { $lte: new Date(timestamp) },
      end_ts: { $gte: new Date(timestamp) },
    }).lean();

    if (!activeSpendQuests.length) return { success: true, retryable: false };

    for (const quest of activeSpendQuests) {
      const targetCurrency = quest.goal_target_metadata?.currency;
      if (targetCurrency && currency && targetCurrency.toLowerCase() !== currency.toLowerCase()) {
        console.log(`[QuestEngine/Spend] Quest ${quest._id} targets currency ${targetCurrency}, event is for ${currency}. Skipping.`);
        continue;
      }

      console.log(`[QuestEngine/Spend] Processing quest ${quest.title} (${quest._id}) for spend by ${userId} of ${amountSpent}`);
      await QuestContribution.findOneAndUpdate(
        { quest_id: quest._id, user_id: userId, squad_id: null }, // Ensure squad_id is null
        { $inc: { metric_value: amountSpent } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

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
          scope: quest.scope, // Add scope
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
            rabbitmqConfig.eventsExchange, // Or direct
            rabbitmqConfig.rewardDistributionQueue, // Routing key or queue name
            { questId: quest._id.toString(), questTitle: quest.title, completedAt: new Date().toISOString(), scope: quest.scope }
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

async function handleSquadPointsEvent(message) {
  console.log(`[QuestEngine/SquadPoints] Received squad.points.updated event:`, message);
  const { squadId, pointsChange, timestamp, reason } = message; // reason and responsibleUserId are optional

  if (!squadId || typeof pointsChange !== 'number') {
    console.error('[QuestEngine/SquadPoints] Invalid message payload for squad.points.updated', message);
    return { success: true, retryable: false }; // ACK invalid message
  }

  try {
    const activeSquadPointQuests = await CommunityQuest.find({
      status: 'active',
      goal_type: 'total_squad_points',
      scope: 'squad', // Explicitly for squad quests
      start_ts: { $lte: new Date(timestamp || Date.now()) }, // Use event timestamp or now
      end_ts: { $gte: new Date(timestamp || Date.now()) },
    }).lean();

    if (!activeSquadPointQuests.length) {
      console.log(`[QuestEngine/SquadPoints] No active 'total_squad_points' quests for squad ${squadId}.`);
      return { success: true, retryable: false };
    }

    for (const quest of activeSquadPointQuests) {
      console.log(`[QuestEngine/SquadPoints] Processing quest ${quest.title} (${quest._id}) for squad ${squadId}, points change: ${pointsChange}`);

      // For 'total_squad_points' quests, the 'user_id' in QuestContribution will store the 'squadId'.
      // The metric_value will be the total points accumulated by that squad for this quest.
      // We increment the squad's total points for this quest by `pointsChange`.
      // This assumes pointsChange is the delta. If it's the new total, adjust logic.
      // Let's assume `pointsChange` is the DELTA of points the squad gained/lost in the event.
      // The quest tracks the SUM of all positive contributions for that squad towards the quest goal.
      // If `pointsChange` can be negative, we might need to decide if that reduces progress.
      // For simplicity, let's assume `pointsChange` is always positive for quest contribution.
      // Or, more robustly, we should fetch the squad's current total points from the Users/Squads collection
      // and set that as the metric_value. This event (`squad.points.updated`) might carry the *new total* or a *delta*.
      // The payload description was: { squadId, pointsChange, reason, timestamp, responsibleUserId (optional) ... }
      // Let's assume `pointsChange` is the DELTA to be added to the quest progress for this event.
      // The QuestContribution's metric_value will then be the sum of all such deltas.

      if (pointsChange > 0) { // Only process positive changes for quest accumulation, or adjust if goal is different
        await QuestContribution.findOneAndUpdate(
          { quest_id: quest._id, user_id: squadId, squad_id: squadId }, // user_id is the squadId, squad_id is also squadId for clarity/filtering
          { $inc: { metric_value: pointsChange } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      } else {
        console.log(`[QuestEngine/SquadPoints] Points change (${pointsChange}) is not positive for squad ${squadId}, quest ${quest._id}. No contribution update.`);
        // If negative changes should decrease progress, this logic would need to change.
        // For now, quests usually only track positive progress towards a goal.
      }

      // Recalculate overall quest progress (sum of all contributions for this quest for this squad)
      // This is effectively the QuestContribution.metric_value for this specific record.
      const squadContribution = await QuestContribution.findOne({
        quest_id: quest._id,
        user_id: squadId, // which is squadId
        squad_id: squadId
      }).lean();

      const currentSquadProgress = squadContribution ? squadContribution.metric_value : 0;
      console.log(`[QuestEngine/SquadPoints] Quest ${quest._id} current progress for squad ${squadId}: ${currentSquadProgress} / ${quest.goal_target}`);

      // Redis update and RabbitMQ publish
      // Note: For squad quests, the progress is per squad. The Redis key and event payload need to reflect this.
      // We might have a general quest progress update, and clients can filter/display based on scope and squadId.
      const questProgressKey = `${redisConfig.defaultQuestProgressKeyPrefix}${quest._id}_squad_${squadId}`; // Make Redis key squad-specific
      await redisService.set(questProgressKey, {
        current: currentSquadProgress,
        goal: quest.goal_target,
        updated_at: new Date().toISOString()
      });

      await rabbitmqService.publishToExchange(
        rabbitmqConfig.questProgressExchange,
        rabbitmqConfig.questProgressChanged,
        {
          questId: quest._id.toString(),
          questTitle: quest.title,
          currentProgress: currentSquadProgress,
          goalTarget: quest.goal_target,
          scope: quest.scope, // 'squad'
          squadId: squadId,   // Identify the squad this progress belongs to
          // lastContributorWalletAddress: message.responsibleUserId, // Optional: if we want to show who in squad triggered
          updatedAt: new Date().toISOString()
        }
      );

      if (currentSquadProgress >= quest.goal_target && quest.status !== 'succeeded' && quest.status !== 'failed') {
        // IMPORTANT: For squad quests, 'succeeded' might mean *this squad* completed it.
        // The quest itself (CommunityQuest document) might only turn to 'succeeded' if, for example,
        // it's a race and only the first N squads can win.
        // For now, let's assume if a squad meets the target, it's a success *for that squad*
        // and triggers reward distribution for that squad. The global quest status might not change.
        // OR, if the quest is *only* for one squad (e.g. admin creates a quest for a specific squad_id), then quest status changes.
        // This needs clarification. For now, let's assume this quest is completed by this squad.

        // To handle this, we might need a separate collection: SquadQuestStatus { quest_id, squad_id, status, completed_at }
        // Or, if a quest of scope 'squad' can be completed by multiple squads independently:
        // The CommunityQuest.status might remain 'active' until end_ts.
        // We'd log completion in QuestRewardLedger or a similar place for the squad.

        // Simpler approach: If a squad quest is completed, we mark the *quest* as succeeded
        // if it's not already. This implies only one squad can "win" or complete it first.
        // This might not be desired.

        // Alternative: The `CommunityQuest.status` remains 'active'. We just trigger rewards.
        // Let's refine the reward trigger:
        // Check if this squad has already been marked for rewards for this quest to prevent double-triggering.
        // This could be done by checking QuestRewardLedger.

        console.log(`[QuestEngine/SquadPoints] Squad ${squadId} COMPLETED quest ${quest._id}! Enqueuing for reward distribution for this squad.`);
        // We don't change the main quest.status here unless it's a single-winner quest.
        // The reward distributor will handle giving rewards to this specific squad.
        // We need to ensure the reward distributor knows it's for a specific squad.
        await rabbitmqService.publishToExchange(
          rabbitmqConfig.eventsExchange,
          rabbitmqConfig.rewardDistributionQueue,
          {
            questId: quest._id.toString(),
            questTitle: quest.title,
            scope: quest.scope, // 'squad'
            squadId: squadId,   // The squad that completed it
            completedAt: new Date().toISOString()
          }
        );
        // Potentially log this squad's completion separately if the main quest can be completed by many squads.
        // For now, the reward distribution event carries the squadId.
      }
    }
    return { success: true, retryable: false };
  } catch (error) {
    console.error('[QuestEngine/SquadPoints] Error processing squad.points.updated:', error);
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
    const dlqRoutingKey = `${rabbitmqConfig.dlqRoutingKeyPrefix}${queueName}`;

    await channel.assertExchange(dlxName, 'direct', { durable: true });
    await channel.assertQueue(dlqName, { durable: true });
    await channel.bindQueue(dlqName, dlxName, dlqRoutingKey);
    console.log(`[QuestEngine] DLX (${dlxName}) and DLQ (${dlqName}) setup complete. Bound with key: ${dlqRoutingKey}`);

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
    await channel.bindQueue(queueName, rabbitmqConfig.eventsExchange, rabbitmqConfig.routingKeys.squadPointsUpdated); // Bind new event
    console.log(`[QuestEngine] Bound to routing keys: ${rabbitmqConfig.routingKeys.userReferredSuccess}, ${rabbitmqConfig.routingKeys.userTierUpdated}, ${rabbitmqConfig.routingKeys.userSpendRecorded}, ${rabbitmqConfig.routingKeys.squadPointsUpdated}`);

    await channel.assertExchange(rabbitmqConfig.eventsExchange, 'topic', { durable: true }); // Ensure exchange type is correct
    console.log(`[QuestEngine] Events exchange '${rabbitmqConfig.eventsExchange}' asserted for publishing completion triggers.`);

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
          } else if (routingKey === rabbitmqConfig.routingKeys.squadPointsUpdated) { // Handle new event
            handlerResult = await handleSquadPointsEvent(messageContent);
          } else {
            console.warn(`[QuestEngine] Received message with unhandled routing key: ${routingKey}. Discarding (ACKing).`);
            handlerResult = { success: true, retryable: false };
          }
        } catch (processingError) {
          console.error('[QuestEngine] Uncaught error during message processing logic:', processingError);
          handlerResult = { success: false, retryable: false }; // Default to non-retryable for safety
        }

        if (handlerResult.success) {
          channel.ack(msg);
        } else {
          attempt++;
          if (attempt <= MAX_RETRIES && handlerResult.retryable) {
            console.log(`[QuestEngine] NACKing message for retry (attempt ${attempt}/${MAX_RETRIES}). Message:`, messageContent);
            channel.nack(msg, false, true); // Requeue
          } else {
            console.error(`[QuestEngine] Message processing failed after ${attempt - 1} attempts or was non-retryable. Sending to DLQ. Message:`, messageContent);
            channel.nack(msg, false, false); // Send to DLX
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

// Export internal handlers *only* in dev/test environments for testing purposes
let exportedHandlers = {};
if (process.env.NODE_ENV === 'test') {
  exportedHandlers = {
    handleUserReferredEvent,
    handleUserTierUpdateEvent,
    handleUserSpendEvent,
    handleSquadPointsEvent,
  };
}
export const _testExports = exportedHandlers; // Use a specific export name to avoid conflicts 