import { Db, ObjectId } from 'mongodb';
import { NotificationDocument, NotificationType } from '@/lib/mongodb';

export async function createNotification(
  db: Db,
  recipientWalletAddress: string,
  type: NotificationType,
  title: string,
  message: string,
  ctaUrl?: string,
  relatedQuestId?: string,
  relatedQuestTitle?: string,
  relatedSquadId?: string,
  relatedSquadName?: string,
  relatedUserId?: string,
  relatedUserName?: string,
  relatedInvitationId?: string,
  rewardAmount?: number,
  rewardCurrency?: string,
  badgeId?: string
): Promise<void> {
  const notificationsCollection = db.collection<NotificationDocument>('notifications');
  
  const now = new Date();
  const newNotificationData: Omit<NotificationDocument, '_id'> = {
    userId: recipientWalletAddress,
    type,
    title,
    message,
    ctaUrl,
    isRead: false,
    createdAt: now,
    updatedAt: now,
    ...(relatedQuestId && { relatedQuestId }),
    ...(relatedQuestTitle && { relatedQuestTitle }),
    ...(relatedSquadId && { relatedSquadId }),
    ...(relatedSquadName && { relatedSquadName }),
    ...(relatedUserId && { relatedUserId }),
    ...(relatedUserName && { relatedUserName }),
    ...(relatedInvitationId && { relatedInvitationId }),
    ...(rewardAmount && { rewardAmount }),
    ...(rewardCurrency && { rewardCurrency }),
    ...(badgeId && { badgeId }),
  };

  try {
    const result = await notificationsCollection.insertOne(newNotificationData as NotificationDocument);
    console.log(`Notification created: ${type} for ${recipientWalletAddress} (DB ID: ${result.insertedId})`);
  } catch (error) {
    console.error(`Failed to create notification (${type}) for ${recipientWalletAddress}:`, error);
    // Depending on your error handling strategy, you might re-throw or handle silently
  }
} 