import CommunityQuest from '../models/communityQuest.model.js'; // Assuming .js for standalone scheduler
import QuestContribution from '../models/questContribution.model.js'; // Added for participation check
import { connectToDatabase } from '../lib/mongodb.js'; // Assuming .js
import { notificationService } from './notification.service.js'; // Added for creating notifications

async function activateScheduledQuests() {
  console.log('[QuestLifecycleService] Checking for scheduled quests to activate...');
  let activatedQuestsData = []; // To store data of quests that are activated
  let notifiedCount = 0; // To track how many notifications were attempted/created
  try {
    await connectToDatabase();
    const now = new Date();
    
    // Find quests to activate
    const questsToActivate = await CommunityQuest.find({
      status: 'scheduled',
      start_ts: { $lte: now }
    }).lean(); // Use .lean() as we only need data for notification

    if (questsToActivate.length === 0) {
      // console.log('[QuestLifecycleService] No scheduled quests were due for activation.');
      return { activated: 0, notified: 0 };
    }

    const activationIds = questsToActivate.map(q => q._id);
    const result = await CommunityQuest.updateMany(
      { _id: { $in: activationIds } },
      { $set: { status: 'active', updated_ts: now } }
    );

    if (result.modifiedCount > 0) {
      console.log(`[QuestLifecycleService] Activated ${result.modifiedCount} scheduled quests.`);
      // Filter the original lean objects that were successfully updated
      activatedQuestsData = questsToActivate.filter(q => 
        activationIds.some(id => id.equals(q._id)) // Ensure comparison works for ObjectIds
      );
      
      for (const quest of activatedQuestsData) {
        // Create a general notification that a new quest has started.
        // Instead of sending to all users (which could be too many),
        // send to a placeholder recipient. This can be used by other systems
        // to announce on social media, a global in-app feed, or to admins.
        await notificationService.createNotification(
          'SYSTEM_ANNOUNCEMENT_CHANNEL', // Placeholder recipient
          'quest_newly_active',
          `A new community quest has started: "${quest.title}"! Join now!`,
          {
            relatedQuestId: quest._id.toString(),
            relatedQuestTitle: quest.title
          }
        );
        notifiedCount++;
      }
      if (notifiedCount > 0) {
        console.log(`[QuestLifecycleService] Created ${notifiedCount} 'quest_newly_active' system notifications.`);
      }
    }
    return { activated: result.modifiedCount, notified: notifiedCount };
  } catch (error) {
    console.error('[QuestLifecycleService] Error activating scheduled quests:', error);
    return { activated: 0, notified: 0, error };
  }
}

async function expireOverdueQuests() {
  console.log('[QuestLifecycleService] Checking for active quests to expire/fail...');
  let expiredCount = 0;
  let notifiedUserCount = 0;
  try {
    await connectToDatabase();
    const now = new Date();

    // Find active quests whose end_ts has passed and are not yet succeeded
    const overdueActiveQuests = await CommunityQuest.find({
      status: 'active',
      end_ts: { $lt: now }
    }).lean(); // Use .lean() for reading data before update

    if (overdueActiveQuests.length > 0) {
      const overdueIds = overdueActiveQuests.map(q => q._id);
      const updateResult = await CommunityQuest.updateMany(
        { _id: { $in: overdueIds }, status: 'active' }, // Ensure status is still active
        { $set: { status: 'expired', updated_ts: now } } // Mark as expired
      );
      expiredCount += updateResult.modifiedCount;
      if (updateResult.modifiedCount > 0) {
        console.log(`[QuestLifecycleService] Expired ${updateResult.modifiedCount} overdue active quests.`);
        // For each expired quest, notify participants
        for (const quest of overdueActiveQuests) {
          if (overdueIds.includes(quest._id)) { // Process only if it was part of the update batch
            const participants = await QuestContribution.find({ quest_id: quest._id, metric_value: { $gt: 0 } }).distinct('user_id');
            if (participants.length > 0) {
              console.log(`[QuestLifecycleService] Notifying ${participants.length} participants of expired quest "${quest.title}"`);
              for (const userId of participants) {
                // Assuming user_id from QuestContribution can be used as recipientWalletAddress
                // This requires QuestContribution.user_id to be the wallet address string or a ref that resolves to it.
                // If user_id is an ObjectId, you might need to fetch the user doc to get walletAddress.
                // For simplicity, assuming userId (from distinct) is a walletAddress here.
                await notificationService.createNotification(
                  userId.toString(), // Ensure it's a string, adjust if user_id is not walletAddress
                  'quest_failed_community',
                  `The community quest "${quest.title}" has ended and the goal was not met. Better luck next time!`,
                  { relatedQuestId: quest._id.toString(), relatedQuestTitle: quest.title }
                );
                notifiedUserCount++;
              }
            }
          }
        }
      }
    }

    // Handle scheduled quests whose end_ts has also passed (as before)
    const pastScheduledResult = await CommunityQuest.updateMany(
      { status: 'scheduled', end_ts: { $lt: now } },
      { $set: { status: 'expired', notes: 'Expired before activation window.', updated_ts: now } }
    );
    if (pastScheduledResult.modifiedCount > 0) {
      console.log(`[QuestLifecycleService] Expired ${pastScheduledResult.modifiedCount} scheduled quests whose end time already passed.`);
      expiredCount += pastScheduledResult.modifiedCount;
    }

    return { expired: expiredCount, notifiedParticipants: notifiedUserCount };
  } catch (error) {
    console.error('[QuestLifecycleService] Error expiring/failing quests:', error);
    return { expired: 0, notifiedParticipants: 0, error };
  }
}

export const questLifecycleService = {
  activateScheduledQuests,
  expireOverdueQuests,
}; 