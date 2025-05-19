export async function createNotification(db, recipientWalletAddress, type, title, message, ctaUrl, relatedQuestId, relatedQuestTitle, relatedSquadId, relatedSquadName, relatedUserId, relatedUserName, relatedInvitationId, rewardAmount, rewardCurrency, badgeId) {
    const notificationsCollection = db.collection('notifications');
    const now = new Date();
    const newNotificationData = Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ userId: recipientWalletAddress, type,
        title,
        message,
        ctaUrl, isRead: false, createdAt: now, updatedAt: now }, (relatedQuestId && { relatedQuestId })), (relatedQuestTitle && { relatedQuestTitle })), (relatedSquadId && { relatedSquadId })), (relatedSquadName && { relatedSquadName })), (relatedUserId && { relatedUserId })), (relatedUserName && { relatedUserName })), (relatedInvitationId && { relatedInvitationId })), (rewardAmount && { rewardAmount })), (rewardCurrency && { rewardCurrency })), (badgeId && { badgeId }));
    try {
        // Duplicate prevention: avoid spamming the same user with the same notification context while it is unread
        const duplicateCheckQuery = {
            userId: recipientWalletAddress,
            type,
            isRead: false,
        };
        if (relatedInvitationId)
            duplicateCheckQuery.relatedInvitationId = relatedInvitationId;
        if (relatedQuestId)
            duplicateCheckQuery.relatedQuestId = relatedQuestId;
        if (relatedSquadId)
            duplicateCheckQuery.relatedSquadId = relatedSquadId;
        if (relatedUserId)
            duplicateCheckQuery.relatedUserId = relatedUserId;
        const existing = await notificationsCollection.findOne(duplicateCheckQuery);
        if (existing) {
            // Update timestamp & maybe message to keep it fresh instead of inserting new duplicate
            await notificationsCollection.updateOne({ _id: existing._id }, { $set: { updatedAt: now, message } });
            console.log(`Notification deduped: updated ${type} for ${recipientWalletAddress} (DB ID: ${existing._id})`);
            return;
        }
        const result = await notificationsCollection.insertOne(newNotificationData);
        console.log(`Notification created: ${type} for ${recipientWalletAddress} (DB ID: ${result.insertedId})`);
    }
    catch (error) {
        console.error(`Failed to create notification (${type}) for ${recipientWalletAddress}:`, error);
        // Depending on your error handling strategy, you might re-throw or handle silently
    }
}
