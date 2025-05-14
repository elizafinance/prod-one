import { v4 as uuidv4 } from 'uuid';
export async function createNotification(db, recipientWalletAddress, type, message, relatedSquadId, relatedSquadName, relatedUserWalletAddress, relatedUserXUsername, relatedInvitationId) {
    const notificationsCollection = db.collection('notifications');
    const notificationId = type === 'squad_invite_received' && relatedInvitationId
        ? relatedInvitationId
        : uuidv4();
    const newNotification = {
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
    }
    catch (error) {
        console.error(`Failed to create notification (${type}) for ${recipientWalletAddress}:`, error);
        // Depending on your error handling strategy, you might re-throw or handle silently
    }
}
