import { rabbitmqService } from '../../services/rabbitmq.service';
import { rabbitmqConfig } from '../../config/rabbitmq.config';
import { connectToDatabase, UserDocument } from '../../lib/mongodb.js';
import CommunityQuest from '../../models/communityQuest.model.js';
import QuestContribution from '../../models/questContribution.model.js';
import QuestRewardLedger from '../../models/questRewardLedger.model.js';
import { notificationService } from '../../services/notification.service.js';

const MAX_RETRIES_REWARD_DIST = 3;

async function handleRewardDistributionEvent(message) {
  const { questId, questTitle, completedAt } = message;
  console.log(`[RewardDistributor] Received event to distribute rewards for quest: ${questTitle} (${questId}) completed at ${completedAt}`);

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');

    const quest = await CommunityQuest.findById(questId).lean();

    if (!quest) {
      console.error(`[RewardDistributor] Quest ${questId} not found. Cannot distribute rewards.`);
      return { success: true, retryable: false }; // ACK, non-retryable (quest gone)
    }

    if (quest.status !== 'succeeded') {
      console.warn(`[RewardDistributor] Quest ${questId} is not in 'succeeded' state (current: ${quest.status}). Skipping.`);
      return { success: true, retryable: false }; // ACK, non-retryable (state changed)
    }

    const eligibleContributions = await QuestContribution.find({
      quest_id: quest._id,
      metric_value: { $gt: 0 } // Only users who contributed
    }).lean();

    if (!eligibleContributions.length) {
      console.log(`[RewardDistributor] No eligible participants for quest ${questId}.`);
      return { success: true, retryable: false }; // ACK, no one to reward
    }

    console.log(`[RewardDistributor] Found ${eligibleContributions.length} eligible participants for quest ${questId}.`);
    let allUsersProcessedSuccessfully = true;

    for (const contribution of eligibleContributions) {
      try {
        // Note: contribution.user_id is an ObjectId from QuestContribution schema
        const user = await usersCollection.findOne({ _id: contribution.user_id }); 
        if (!user) {
          console.warn(`[RewardDistributor] User ${contribution.user_id} for quest ${questId} not found. Skipping reward for this user.`);
          continue; // Skip this user, but don't fail the whole batch for one missing user
        }

        let rewardsGivenThisUser = [];

        // 1. Distribute Points
        if ((quest.reward_type === 'points' || quest.reward_type === 'points+nft') && quest.reward_points && quest.reward_points > 0) {
          // Ensure idempotency: Check if this user already received points for this quest
          const existingPointsReward = await QuestRewardLedger.findOne({
            quest_id: quest._id,
            user_id: user._id,
            reward_type: 'points'
          });

          if (!existingPointsReward) {
            await usersCollection.updateOne({ _id: user._id }, { $inc: { points: quest.reward_points }, $set: { updatedAt: new Date() } });
            await QuestRewardLedger.create({
              quest_id: quest._id,
              user_id: user._id,
              reward_type: 'points',
              reward_details: { points_awarded: quest.reward_points, quest_title: quest.title },
              status: 'issued' // or 'claimed' if points are immediate
            });
            rewardsGivenThisUser.push(`${quest.reward_points} points`);
            console.log(`[RewardDistributor] Awarded ${quest.reward_points} points to user ${user._id} for quest ${questId}.`);
          } else {
            console.log(`[RewardDistributor] User ${user._id} already received points for quest ${questId}. Skipping.`);
          }
        }

        // 2. Distribute NFT (Placeholder for actual NFT logic)
        if ((quest.reward_type === 'nft' || quest.reward_type === 'points+nft') && quest.reward_nft_id) {
          // Ensure idempotency: Check if this user already received/flagged for NFT for this quest
          const existingNftReward = await QuestRewardLedger.findOne({
            quest_id: quest._id,
            user_id: user._id,
            reward_type: 'nft'
          });

          if (!existingNftReward) {
            console.log(`[RewardDistributor] User ${user._id} eligible for NFT ${quest.reward_nft_id} for quest ${questId}. (TODO: Implement minting)`);
            // TODO: Implement actual NFT minting/distribution trigger here
            // This might involve calling an external service, an on-chain transaction, or adding to a minting queue.
            await QuestRewardLedger.create({
              quest_id: quest._id,
              user_id: user._id,
              reward_type: 'nft',
              reward_details: { nft_id: quest.reward_nft_id, quest_title: quest.title, status_remark: 'Pending Mint/Claim' },
              status: 'pending' // Or 'issued' if NFT is off-chain and immediately available
            });
            rewardsGivenThisUser.push(`NFT ${quest.reward_nft_id}`);
            console.log(`[RewardDistributor] Flagged user ${user._id} for NFT ${quest.reward_nft_id} for quest ${questId}.`);
          } else {
            console.log(`[RewardDistributor] User ${user._id} already flagged/received NFT for quest ${questId}. Skipping.`);
          }
        }
        if (rewardsGivenThisUser.length > 0) {
          allUsersProcessedSuccessfully = true;
        }

        // Create notification if any reward was processed in this attempt for the user
        if (rewardsGivenThisUser.length > 0) {
          const rewardMessage = rewardsGivenThisUser.join(' & ');
          await notificationService.createNotification(
            user.walletAddress, // Assuming user document has walletAddress
            'quest_reward_received',
            `Congratulations! You received ${rewardMessage} from the community quest: "${quest.title}".`,
            {
              relatedQuestId: quest._id.toString(),
              relatedQuestTitle: quest.title,
              rewardSummary: rewardMessage
            }
          );
        }

      } catch (userRewardError) {
        console.error(`[RewardDistributor] Error distributing rewards to user ${contribution.user_id} for quest ${questId}:`, userRewardError);
        allUsersProcessedSuccessfully = false; // Mark that at least one user failed
        // For individual user errors, we might log and continue, rather than retrying the whole batch.
        // If a specific user error *should* retry the whole message, this logic needs adjustment.
      }
    }

    if (!allUsersProcessedSuccessfully) {
        console.warn(`[RewardDistributor] Some errors occurred during reward distribution for quest ${questId}. Check logs. The message will be ACKed if all DB/network operations for the main check were okay.`);
        // Depending on severity, could return { success: false, retryable: true } to retry the whole batch
        // For now, if main quest checks passed, we ACK and assume individual errors are logged.
    }
    return { success: true, retryable: false }; // Assume success if we reached here, individual errors logged

  } catch (error) {
    console.error(`[RewardDistributor] Critical error processing reward distribution for quest ${questId}:`, error);
    const retryable = error.name === 'MongoNetworkError'; // Only retry for DB network issues here
    return { success: false, retryable };
  }
}

async function consumeRewardDistributionEvents() {
  try {
    const channel = await rabbitmqService.getChannel();
    const queueName = rabbitmqConfig.rewardDistributionQueue;
    const dlxName = rabbitmqConfig.deadLetterExchange;
    const dlqName = rabbitmqConfig.rewardDistributionDLQ;
    const dlqRoutingKey = `${rabbitmqConfig.dlqRoutingKeyPrefix}${queueName}`;

    await channel.assertExchange(dlxName, 'direct', { durable: true });
    await channel.assertQueue(dlqName, { durable: true });
    await channel.bindQueue(dlqName, dlxName, dlqRoutingKey);
    console.log(`[RewardDistributor] DLX (${dlxName}) and DLQ (${dlqName}) setup complete. Bound with key: ${dlqRoutingKey}`);

    await channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': dlxName,
        'x-dead-letter-routing-key': dlqRoutingKey
      }
    });
    console.log(`[RewardDistributor] Queue '${queueName}' asserted with DLX routing to '${dlxName}' with key '${dlqRoutingKey}'.`);

    // Binding to eventsExchange as QuestEngine publishes the trigger there with queueName as routing key
    await channel.bindQueue(queueName, rabbitmqConfig.eventsExchange, queueName);
    console.log(`[RewardDistributor] Bound queue ${queueName} to exchange ${rabbitmqConfig.eventsExchange} with key ${queueName}. Waiting for messages.`);

    channel.consume(queueName, async (msg) => {
      if (msg !== null) {
        let messageContent;
        try {
          messageContent = JSON.parse(msg.content.toString());
        } catch (parseError) {
          console.error('[RewardDistributor] Failed to parse message. Discarding (ACKing):', parseError, msg.content.toString());
          channel.ack(msg);
          return;
        }

        let attempt = (msg.properties.headers && msg.properties.headers['x-retries']) || 0;
        let handlerResult = { success: false, retryable: false };

        try {
          handlerResult = await handleRewardDistributionEvent(messageContent);
        } catch (processingError) {
          console.error('[RewardDistributor] Uncaught error during message processing:', processingError);
          handlerResult = { success: false, retryable: false }; 
        }

        if (handlerResult.success) {
          channel.ack(msg);
        } else {
          attempt++;
          if (attempt <= MAX_RETRIES_REWARD_DIST && handlerResult.retryable) {
            console.log(`[RewardDistributor] NACKing message for retry (attempt ${attempt}/${MAX_RETRIES_REWARD_DIST}). Message:`, messageContent);
            channel.nack(msg, false, true); // Requeue
          } else {
            console.error(`[RewardDistributor] Message failed after ${attempt-1} attempts or non-retryable. Sending to DLQ. Message:`, messageContent);
            channel.nack(msg, false, false); // Send to DLX
          }
        }
      }
    });
  } catch (error) {
    console.error('[RewardDistributor] Failed to start consumer:', error);
    process.exit(1);
  }
}

export const rewardDistributorService = {
  start: consumeRewardDistributionEvents,
}; 