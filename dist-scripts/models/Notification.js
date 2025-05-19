import mongoose, { Schema } from 'mongoose';
const NotificationSchema = new Schema({
    recipientUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true }, // Optional, if direct user mapping exists
    recipientWalletAddress: { type: String, required: true, index: true },
    type: {
        type: String,
        enum: ['proposal_created', 'proposal_passed', 'proposal_failed', 'proposal_executed', 'proposal_broadcasted', 'squad_invite', 'general'],
        required: true,
    },
    title: { type: String, required: true, maxlength: 100 },
    message: { type: String, required: true, maxlength: 500 },
    data: { type: Schema.Types.Mixed },
    isRead: { type: Boolean, default: false, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
});
NotificationSchema.index({ recipientWalletAddress: 1, isRead: 1, createdAt: -1 }); // Common query for user notifications
export const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
