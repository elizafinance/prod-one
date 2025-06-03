import mongoose, { Document, Schema, Types } from 'mongoose';

interface INotification extends Document {
  recipientUserId: Types.ObjectId; // Or recipientWalletAddress if users might not be registered
  recipientWalletAddress: string; 
  type: 'proposal_created' | 'proposal_passed' | 'proposal_failed' | 'proposal_executed' | 'proposal_broadcasted' | 'squad_invite' | 'general';
  title: string;
  message: string;
  data?: Record<string, any>; // For things like proposalId, squadId, etc.
  isRead: boolean;
  createdAt: Date;
  notificationId: string;
}

const NotificationSchema = new Schema<INotification>({
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
  notificationId: { type: String, required: true, unique: true, index: true },
});

NotificationSchema.index({ recipientWalletAddress: 1, isRead: 1, createdAt: -1 }); // Common query for user notifications

export const Notification = mongoose.models.Notification || mongoose.model<INotification>('Notification', NotificationSchema);
export type { INotification }; 