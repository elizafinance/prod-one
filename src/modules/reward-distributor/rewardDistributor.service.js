import { rabbitmqService } from '../../services/rabbitmq.service.js';
import { rabbitmqConfig } from '../../config/rabbitmq.config.js';
import { connectToDatabase } from '../../../dist-scripts/lib/mongodb.js';
import CommunityQuest from '../../models/communityQuest.model.js';
import QuestContribution from '../../models/questContribution.model.js';
import QuestRewardLedger from '../../models/questRewardLedger.model.js';
import { notificationService } from '../../services/notification.service.js';
import { User } from '../../../dist-scripts/models/User.js';
import { Squad } from '../../../dist-scripts/models/Squad.js';

const MAX_RETRIES = 3;

async function processQuestCompletion(message) {
  const { questId, questTitle, completedAt, scope, squadId: completedSquadId } = message;
  console.log(`[RewardDistributor] Received quest completion for distribution. QuestID: ${questId}, Scope: ${scope}, SquadID (if any): ${completedSquadId}`);

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');

    const quest = await CommunityQuest.findById(questId).lean();
    if (!quest) {
      console.error(`[RewardDistributor] Quest ${questId} not found. Discarding message.`);
      return { success: true, retryable: false };
    }

    if (quest.status !== 'succeeded' && scope !== 'squad') {
        // For community quests, we might rely on the quest status being 'succeeded'
        // For squad quests, the main quest status might not change if multiple squads can complete it.
        // The event from QuestEngine for squad completion is the trigger.
        console.warn(`[RewardDistributor] Quest ${questId} (community scope) is not in 'succeeded' state (current: ${quest.status}). Proceeding with caution or potentially skipping.`);
        // Depending on rules, might return or proceed. For now, let's proceed if event received.
    }

    if (!quest.rewards || quest.rewards.length === 0) {
      console.log(`[RewardDistributor] Quest ${questId} has no defined rewards. Nothing to distribute.`);
      return { success: true, retryable: false };
    }

    if (scope === 'squad') {
      if (!completedSquadId) {
        console.error(`[RewardDistributor] Squad quest ${questId} completion event missing squadId. Discarding.`);
        return { success: true, retryable: false };
      }
      await distributeRewardsForSquad(quest, completedSquadId, completedAt);
    } else {
      await distributeRewardsForCommunityQuest(quest, completedAt);
    }

    return { success: true, retryable: false };
  } catch (error) {
    console.error(`[RewardDistributor] Error processing quest ${questId} completion:`, error);
    const retryable = error.name === 'MongoNetworkError'; // Add other retryable errors as needed
    return { success: false, retryable };
  }
}

async function distributeRewardsForSquad(quest, squadId, completedAt) {
  console.log(`[RewardDistributor/Squad] Distributing rewards for quest ${quest._id} to squad ${squadId}`);
  const squad = await Squad.findOne({ squadId: squadId }).lean();
  if (!squad) {
    console.error(`[RewardDistributor/Squad] Squad ${squadId} not found for quest ${quest._id}. Cannot distribute rewards.`);
    return;
  }

  let recipients = [];
  switch (quest.reward_split) {
    case 'leader_only':
      if (squad.leaderWalletAddress) recipients = [squad.leaderWalletAddress];
      break;
    case 'equal':
      recipients = squad.memberWalletAddresses || [];
      break;
    case 'proportional':
      console.warn(`[RewardDistributor/Squad] 'proportional' reward split for squad quest ${quest._id} is not fully supported, defaulting to 'equal'.`);
      recipients = squad.memberWalletAddresses || [];
      break;
    case 'none':
    default:
      console.log(`[RewardDistributor/Squad] Reward split is '${quest.reward_split || 'none'}' for quest ${quest._id}. No automated distribution for squad.`);
      return;
  }

  if (!recipients.length) {
    console.log(`[RewardDistributor/Squad] No recipients determined for squad ${squadId}, quest ${quest._id} with split type ${quest.reward_split}.`);
    return;
  }

  for (const reward of quest.rewards) {
    for (const userId of recipients) {
      let uniqueRewardIdentifier = {};
      if (reward.type === 'points') {
        uniqueRewardIdentifier = { 'reward_details.points_awarded': Number(reward.value) }; // Value might be split for 'equal'
      } else if (reward.type === 'spl_token' && reward.value?.tokenMint) {
        uniqueRewardIdentifier = { 'reward_details.spl_token_mint': reward.value.tokenMint, 'reward_details.spl_token_amount': reward.value.amount };
      } else if ((reward.type === 'nft_collection_item' || reward.type === 'nft') && reward.value) {
        uniqueRewardIdentifier = { 'reward_details.nft_mint_address': reward.value }; 
      } else if (reward.type === 'badge' && reward.value) {
        uniqueRewardIdentifier = { 'reward_details.badge_id': reward.value };
      }

      const existingLedger = await QuestRewardLedger.findOne({
        quest_id: quest._id,
        user_id: userId,
        squad_id: squadId, 
        reward_type: reward.type,
        ...uniqueRewardIdentifier // Add specific checks for the reward value to ensure idempotency
      });

      if (existingLedger && existingLedger.status === 'processed') {
        console.log(`[RewardDistributor/Squad] User ${userId} already processed reward type ${reward.type} for squad ${squadId}, quest ${quest._id}. Skipping.`);
        continue;
      }
      
      const ledgerEntry = {
        quest_id: quest._id, user_id: userId, squad_id: squadId, reward_type: reward.type,
        reward_details: {}, reward_description: reward.description || `Reward from squad quest: ${quest.title}`,
        status: 'pending', distributed_at: new Date(completedAt)
      };
      let pointsToAwardUser = 0;

      if (reward.type === 'points') {
        let actualPoints = Number(reward.value);
        if (quest.reward_split === 'equal' && recipients.length > 0) {
            actualPoints = Math.floor(Number(reward.value) / recipients.length);
        }
        ledgerEntry.reward_details.points_awarded = actualPoints;
        pointsToAwardUser = actualPoints;
        if (actualPoints !== 0) { // Only update if there are points to award
            const userUpdateResult = await User.findOneAndUpdate({ walletAddress: userId }, { $inc: { points: actualPoints } }, { new: true });
            if(userUpdateResult) console.log(`[RewardDistributor/Squad] User ${userId} points updated by ${actualPoints}. New total: ${userUpdateResult.points}`);
            else console.warn(`[RewardDistributor/Squad] User ${userId} not found for point update.`);
        }
      } else if (reward.type === 'spl_token') {
        ledgerEntry.reward_details.spl_token_mint = reward.value?.tokenMint;
        ledgerEntry.reward_details.spl_token_amount = reward.value?.amount;
        console.log(`[RewardDistributor/Squad] STUB: Distribute SPL token ${reward.value?.tokenMint} amount ${reward.value?.amount} to ${userId}`);
      } else if (reward.type === 'nft_collection_item' || reward.type === 'nft') {
        ledgerEntry.reward_details.nft_mint_address = reward.value;
        console.log(`[RewardDistributor/Squad] STUB: Distribute NFT from ${reward.value} to ${userId}`);
      } else if (reward.type === 'badge') {
        ledgerEntry.reward_details.badge_id = reward.value;
        const userUpdateResult = await User.findOneAndUpdate({ walletAddress: userId }, { $addToSet: { earnedBadgeIds: reward.value } }, { new: true });
        if(userUpdateResult) console.log(`[RewardDistributor/Squad] User ${userId} awarded badge ${reward.value}. Badges: ${userUpdateResult.earnedBadgeIds?.join(', ')}`);
        else console.warn(`[RewardDistributor/Squad] User ${userId} not found for badge update.`);
      }

      ledgerEntry.status = 'processed'; 
      await QuestRewardLedger.create(ledgerEntry);
      await notificationService.createNotification({
        userId: userId,
        type: 'squad_reward_received',
        title: `🏆 Squad Quest Reward!`,
        message: `Your squad, ${squad.name}, completed '${quest.title}'! You've received a reward. Details: ${reward.description || reward.type}`,
        ctaUrl: `/quests/${quest._id}`,
        relatedQuestId: quest._id.toString(),
        relatedQuestTitle: quest.title,
        relatedSquadId: squadId,
        relatedSquadName: squad.name,
      });
    }
  }
}

async function distributeRewardsForCommunityQuest(quest, completedAt) {
  console.log(`[RewardDistributor/Community] Distributing rewards for community quest ${quest._id}`);
  // Find all unique participants (contributors) for this quest.
  const participants = await QuestContribution.find({ quest_id: quest._id, squad_id: null }).distinct('user_id');

  if (!participants || participants.length === 0) {
    console.log(`[RewardDistributor/Community] No participants found for community quest ${quest._id}.`);
    return;
  }

  console.log(`[RewardDistributor/Community] Found ${participants.length} participants for quest ${quest._id}`);

  for (const reward of quest.rewards) {
    for (const userId of participants) {
      let uniqueRewardIdentifier = {};
      if (reward.type === 'points') {
        uniqueRewardIdentifier = { 'reward_details.points_awarded': Number(reward.value) };
      } else if (reward.type === 'spl_token' && reward.value?.tokenMint) {
        uniqueRewardIdentifier = { 'reward_details.spl_token_mint': reward.value.tokenMint, 'reward_details.spl_token_amount': reward.value.amount };
      } else if ((reward.type === 'nft_collection_item' || reward.type === 'nft') && reward.value) {
        uniqueRewardIdentifier = { 'reward_details.nft_mint_address': reward.value }; 
      } else if (reward.type === 'badge' && reward.value) {
        uniqueRewardIdentifier = { 'reward_details.badge_id': reward.value };
      }

      const existingLedger = await QuestRewardLedger.findOne({
        quest_id: quest._id, user_id: userId, squad_id: null, reward_type: reward.type,
        ...uniqueRewardIdentifier
      });

      if (existingLedger && existingLedger.status === 'processed') {
        console.log(`[RewardDistributor/Community] User ${userId} already processed reward type ${reward.type} for quest ${quest._id}. Skipping.`);
        continue;
      }

      const ledgerEntry = {
        quest_id: quest._id, user_id: userId, squad_id: null, reward_type: reward.type,
        reward_details: {}, reward_description: reward.description || `Reward from community quest: ${quest.title}`,
        status: 'pending', distributed_at: new Date(completedAt)
      };
      let pointsToAwardUser = 0;

      if (reward.type === 'points') {
        const pointsValue = Number(reward.value);
        ledgerEntry.reward_details.points_awarded = pointsValue;
        pointsToAwardUser = pointsValue;
        if (pointsValue !== 0) {
            const userUpdateResult = await User.findOneAndUpdate({ walletAddress: userId }, { $inc: { points: pointsValue } }, { new: true });
            if(userUpdateResult) console.log(`[RewardDistributor/Community] User ${userId} points updated by ${pointsValue}. New total: ${userUpdateResult.points}`);
            else console.warn(`[RewardDistributor/Community] User ${userId} not found for point update.`);
        }
      } else if (reward.type === 'spl_token') {
        ledgerEntry.reward_details.spl_token_mint = reward.value?.tokenMint;
        ledgerEntry.reward_details.spl_token_amount = reward.value?.amount;
        console.log(`[RewardDistributor/Community] STUB: Distribute SPL token ${reward.value?.tokenMint} amount ${reward.value?.amount} to ${userId}`);
      } else if (reward.type === 'nft_collection_item' || reward.type === 'nft') {
        ledgerEntry.reward_details.nft_mint_address = reward.value;
        console.log(`[RewardDistributor/Community] STUB: Distribute NFT from ${reward.value} to ${userId}`);
      } else if (reward.type === 'badge') {
        ledgerEntry.reward_details.badge_id = reward.value;
        const userUpdateResult = await User.findOneAndUpdate({ walletAddress: userId }, { $addToSet: { earnedBadgeIds: reward.value } }, { new: true });
        if(userUpdateResult) console.log(`[RewardDistributor/Community] User ${userId} awarded badge ${reward.value}. Badges: ${userUpdateResult.earnedBadgeIds?.join(', ')}`);
        else console.warn(`[RewardDistributor/Community] User ${userId} not found for badge update.`);
      }

      ledgerEntry.status = 'processed';
      await QuestRewardLedger.create(ledgerEntry);
      await notificationService.createNotification({
        userId: userId,
        type: 'quest_reward_received',
        title: `🎁 Quest Reward!`, 
        message: `You've received a reward for completing '${quest.title}'! Details: ${reward.description || reward.type}`,
        ctaUrl: `/quests/${quest._id}`,
        relatedQuestId: quest._id.toString(),
        relatedQuestTitle: quest.title,
      });
    }
  }
}

async function consumeRewardEvents() {
  try {
    const channel = await rabbitmqService.getChannel();
    const queueName = rabbitmqConfig.rewardDistributionQueue;
    const dlxName = rabbitmqConfig.deadLetterExchange;
    const dlqName = rabbitmqConfig.rewardDistributionDLQ; 
    const dlqRoutingKey = `${rabbitmqConfig.dlqRoutingKeyPrefix}${queueName}`;

    await channel.assertExchange(dlxName, 'direct', { durable: true });
    await channel.assertQueue(dlqName, { durable: true });
    await channel.bindQueue(dlqName, dlxName, dlqRoutingKey);
    console.log(`[RewardDistributor] DLX (${dlxName}) and DLQ (${dlqName}) setup complete for rewards.`);

    await channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': dlxName,
        'x-dead-letter-routing-key': dlqRoutingKey
      }
    });
    console.log(`[RewardDistributor] Queue '${queueName}' asserted with DLX routing.`);

    // Bind to the events exchange with its own queue name as the routing key
    // This assumes QuestEngine publishes to eventsExchange with routingKey = rewardDistributionQueue
    await channel.assertExchange(rabbitmqConfig.eventsExchange, 'topic', { durable: true });
    await channel.bindQueue(queueName, rabbitmqConfig.eventsExchange, queueName);
    console.log(`[RewardDistributor] Bound queue '${queueName}' to exchange '${rabbitmqConfig.eventsExchange}' with routing key '${queueName}'.`);

    channel.consume(queueName, async (msg) => {
      if (msg !== null) {
        let messageContent;
        try {
          messageContent = JSON.parse(msg.content.toString());
        } catch (parseError) {
          console.error('[RewardDistributor] Failed to parse message. Discarding (ACKing):', parseError);
          channel.ack(msg);
          return;
        }

        let attempt = (msg.properties.headers && msg.properties.headers['x-retries']) || 0;
        let handlerResult = { success: false, retryable: false };

        try {
          // No routing key check needed here if queue is directly bound or has specific binding key
          console.log(`[RewardDistributor] Received message for reward distribution, attempt: ${attempt}`, messageContent);
          handlerResult = await processQuestCompletion(messageContent);
        } catch (processingError) {
          console.error('[RewardDistributor] Uncaught error during reward processing:', processingError);
          handlerResult = { success: false, retryable: false };
        }

        if (handlerResult.success) {
          channel.ack(msg);
        } else {
          attempt++;
          if (attempt <= MAX_RETRIES && handlerResult.retryable) {
            console.log(`[RewardDistributor] NACKing reward message for retry (attempt ${attempt}/${MAX_RETRIES}).`);
            channel.nack(msg, false, true); // Requeue
          } else {
            console.error(`[RewardDistributor] Reward message processing failed after ${attempt - 1} attempts or was non-retryable. Sending to DLQ.`);
            channel.nack(msg, false, false); // Send to DLX
          }
        }
      }
    });
  } catch (error) {
    console.error('[RewardDistributor] Failed to start reward consumer:', error);
    process.exit(1);
  }
}

export const rewardDistributorService = {
  start: consumeRewardEvents,
  // Expose individual methods for testing or manual triggers if needed
  processQuestCompletion,
  distributeRewardsForSquad,
  distributeRewardsForCommunityQuest
}; 