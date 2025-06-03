import CommunityQuest from '../models/communityQuest.model.js'; // Assuming .js for standalone scheduler
import QuestContribution from '../models/questContribution.model.js'; // Added for participation check
import { connectToDatabase } from '../lib/mongodb.js'; // Assuming .js
import { createNotification, NotificationType } from '../lib/notificationUtils.js'; // <<<< IMPORT STANDARDIZED UTILITY
import { Db } from 'mongodb'; // For Db type

async function activateScheduledQuests() {
  console.log('[QuestLifecycleService] Checking for scheduled quests to activate...');
  let activatedQuestsData = []; // To store data of quests that are activated
  let notifiedCount = 0; // To track how many notifications were attempted/created
  try {
    const { db } = await connectToDatabase(); // Get Db instance
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
        // If this were to be a user-facing notification via our system for testing:
        // We would need a recipient. For actual system announcements, this might go elsewhere.
        // For now, this demonstrates using createNotification if it *were* user-directed.
        // The original 'SYSTEM_ANNOUNCEMENT_CHANNEL' is not a valid wallet address.
        // To make this runnable in a test scenario where a user gets it, we'd mock a recipient.
        // For the actual service, it might skip user notifications or have a different strategy.
        
        // Example: If we decided admins should get this notification:
        // const adminWallets = ["ADMIN_WALLET_1", "ADMIN_WALLET_2"];
        // for (const adminWallet of adminWallets) {
        //   await createNotification(
        //     db,
        //     adminWallet, 
        //     'quest_newly_active', // Assuming this type exists or is 'general'
        //     `New Quest Active: ${quest.title}`,
        //     `A community quest "${quest.title}" has just started! Monitor its progress. `,
        //     `/admin/quests/${quest._id.toString()}`,
        //     quest._id.toString(),
        //     quest.title
        //   );
        //  notifiedCount++;
        // }

        // For now, let's log that this is where a system-wide announcement would be made,
        // rather than trying to force it into a user-specific notification for this refactor.
        console.log(`[QuestLifecycleService] System Announcement: Quest "${quest.title}" is now active. Actual notification to users/channels would happen via a different mechanism or if this service had user recipients for this event type.`);
        // If we still want to use createNotification for a generic system log or to a specific admin user for testing:
        // (This part is more for showing how to use createNotification if it were applicable)
        // For example, notify a predefined system admin wallet for testing:
        const testAdminRecipient = process.env.TEST_ADMIN_WALLET_FOR_SYSTEM_NOTIFS;
        if (testAdminRecipient) {
            await createNotification(
                db,
                testAdminRecipient,
                'system_message', // Or 'quest_newly_active' if defined & appropriate
                `System: New Quest Active - ${quest.title}`,
                `A community quest "${quest.title}" has just started. (System Notification Test).`,
                `/quests/${quest._id.toString()}`, // General link
                quest._id.toString(),
                quest.title
            );
            notifiedCount++; // Count this test notification
        }
      }
      if (notifiedCount > 0) {
        console.log(`[QuestLifecycleService] Created ${notifiedCount} test system notifications for 'quest_newly_active'.`);
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
    const { db } = await connectToDatabase();
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
          // Ensure we only process quests that were part of the updateMany batch.
          // This check is a bit redundant given the find query but good for safety.
          if (overdueIds.some(id => id.equals(quest._id))) { 
            const participants = await QuestContribution.find({ quest_id: quest._id, metric_value: { $gt: 0 } }).distinct('user_id');
            if (participants.length > 0) {
              console.log(`[QuestLifecycleService] Notifying ${participants.length} participants of expired quest "${quest.title}"`);
              const notificationTitle = `Quest Expired: ${quest.title}`;
              const notificationMessage = `The community quest "${quest.title}" has ended and the goal was not met. Better luck next time!`;
              const ctaUrl = `/quests/${quest._id.toString()}`;

              for (const userId of participants) {
                // Assuming userId from QuestContribution is a walletAddress string
                if (typeof userId === 'string' && userId) { // Basic check
                  await createNotification(
                    db,
                    userId, 
                    'quest_failed_community',
                    notificationTitle,
                    notificationMessage,
                    ctaUrl,
                    quest._id.toString(),
                    quest.title
                  );
                  notifiedUserCount++;
                }
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