import { v4 as uuidv4 } from 'uuid';
export async function createNotification(db, recipientWalletAddress, type, title, message, ctaUrl, relatedQuestId, relatedQuestTitle, relatedSquadId, relatedSquadName, relatedUserId, relatedUserName, relatedInvitationId, rewardAmount, rewardCurrency, badgeId) {
    var _a;
    const notificationsCollection = db.collection('notifications');
    const now = new Date();
    const generatedNotificationId = uuidv4();
    const newNotificationData = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ recipientWalletAddress: recipientWalletAddress, notificationId: generatedNotificationId, type,
        title,
        message,
        ctaUrl, isRead: false, createdAt: now, updatedAt: now }, (relatedQuestId && { relatedQuestId })), (relatedQuestTitle && { relatedQuestTitle })), (relatedSquadId && { relatedSquadId })), (relatedSquadName && { relatedSquadName })), (relatedUserId && { relatedUserId })), (relatedUserName && { relatedUserName })), (relatedInvitationId && { relatedInvitationId })), (rewardAmount && { rewardAmount })), (rewardCurrency && { rewardCurrency })), (badgeId && { badgeId }));
    try {
        // Re-enable deduplication for all types
        const duplicateCheckQuery = {
            recipientWalletAddress: recipientWalletAddress,
            type,
            isRead: false,
        };
        if (relatedInvitationId)
            duplicateCheckQuery.relatedInvitationId = relatedInvitationId;
        else if (relatedQuestId)
            duplicateCheckQuery.relatedQuestId = relatedQuestId;
        else if (relatedSquadId)
            duplicateCheckQuery.relatedSquadId = relatedSquadId;
        const existing = await notificationsCollection.findOne(duplicateCheckQuery);
        if (existing) {
            await notificationsCollection.updateOne({ _id: existing._id }, {
                $set: {
                    updatedAt: now,
                    message,
                    title,
                    ctaUrl,
                    notificationId: existing.notificationId || generatedNotificationId
                },
                $setOnInsert: {}
            });
            console.log(`Notification deduped & updated: type '${type}' for ${recipientWalletAddress}. DB ID: ${(_a = existing._id) === null || _a === void 0 ? void 0 : _a.toString()}. Matched on query: ${JSON.stringify(duplicateCheckQuery)}. Updated notificationId to: ${existing.notificationId || generatedNotificationId}`);
            return;
        }
        const result = await notificationsCollection.insertOne(newNotificationData);
        console.log(`Notification created: type '${type}' for ${recipientWalletAddress}. DB ID: ${result.insertedId.toString()}, notificationId: ${generatedNotificationId}`);
    }
    catch (error) {
        console.error(`Failed to create/update notification (type '${type}') for ${recipientWalletAddress}:`, error);
    }
}
