import { Db } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { NotificationDocument, NotificationType } from '@/lib/mongodb'; // Assuming mongodb.ts is in the same lib directory

export async function createNotification(
  db: Db,
  recipientWalletAddress: string,
  type: NotificationType,
  message: string,
  relatedSquadId?: string,
  relatedSquadName?: string,
  relatedUserWalletAddress?: string,
  relatedUserXUsername?: string,
  relatedInvitationId?: string
): Promise<void> {
  const notificationsCollection = db.collection<NotificationDocument>('notifications');
  
  const notificationId = type === 'squad_invite_received' && relatedInvitationId 
    ? relatedInvitationId 
    : uuidv4();
  
  const newNotification: NotificationDocument = {
    notificationId,
    recipientWalletAddress,
    type,
    message,
    relatedSquadId,
    relatedSquadName,
    relatedUserWalletAddress,
    relatedUserXUsername,
    relatedInvitationId,
    isRead: false,
    createdAt: new Date(),
  };
  try {
    await notificationsCollection.insertOne(newNotification);
    console.log(`Notification created: ${type} for ${recipientWalletAddress} (ID: ${newNotification.notificationId})`);
  } catch (error) {
    console.error(`Failed to create notification (${type}) for ${recipientWalletAddress}:`, error);
    // Depending on your error handling strategy, you might re-throw or handle silently
  }
} 