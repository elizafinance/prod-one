import { connectToDatabase } from '../../dist-scripts/lib/mongodb.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a notification for a user.
 *
 * @param {string} recipientWalletAddress - The wallet address of the user receiving the notification.
 * @param {string} type - The type of notification (should match NotificationType enum from mongodb.ts).
 * @param {string} message - The main notification message.
 * @param {object} [details] - Optional details like relatedQuestId, questTitle, rewardSummary.
 * @param {string} [details.relatedQuestId] - Optional ID of the related quest.
 * @param {string} [details.relatedQuestTitle] - Optional title of the related quest.
 * @param {string} [details.rewardSummary] - Optional summary of the reward.
 */
async function createNotification(
  recipientWalletAddress,
  type,
  message,
  details = {}
) {
  console.log(`[NotificationService] Creating notification for ${recipientWalletAddress}, type: ${type}`);
  try {
    const { db } = await connectToDatabase();
    const notificationsCollection = db.collection('notifications');

    const newNotification = {
      notificationId: uuidv4(),
      recipientWalletAddress,
      type,
      message,
      relatedQuestId: details.relatedQuestId,
      relatedQuestTitle: details.relatedQuestTitle,
      reward_details_summary: details.rewardSummary,
      isRead: false,
      createdAt: new Date(),
    };

    await notificationsCollection.insertOne(newNotification);
    console.log(`[NotificationService] Notification created successfully for ${recipientWalletAddress}: ${message}`);
    return { success: true, notification: newNotification };

  } catch (error) {
    console.error(`[NotificationService] Error creating notification for ${recipientWalletAddress}:`, error);
    return { success: false, error };
  }
}

export const notificationService = {
  createNotification,
  // Potentially add methods here to get notifications for a user, mark as read, etc.
  // These would be used by API routes consumed by the frontend.
}; 