import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  walletAddress: string;
  xUserId: string;
  xUsername?: string;
  xProfileImageUrl?: string;
  points: number;
  referralCode?: string;
  referredBy?: string;
  completedActions?: string[];
  highestAirdropTierLabel?: string;
  referralsMadeCount?: number;
  activeReferralBoosts?: any[];
  squadId?: string;
  earnedBadgeIds?: string[];
  initialAirdropAmount?: number;
  totalEstimatedAirdrop?: number;
  airBasedDefai?: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
  walletAddress: { type: String, required: true, unique: true, index: true },
  xUserId: { type: String, required: true, unique: true },
  xUsername: { type: String },
  xProfileImageUrl: { type: String },
  points: { type: Number, default: 0 },
  referralCode: { type: String },
  referredBy: { type: String },
  completedActions: [{ type: String }],
  highestAirdropTierLabel: { type: String },
  referralsMadeCount: { type: Number, default: 0 },
  activeReferralBoosts: { type: Array },
  squadId: { type: String, index: true },
  earnedBadgeIds: [{ type: String }],
  initialAirdropAmount: { type: Number, default: 0 },
  totalEstimatedAirdrop: { type: Number, default: 0 },
  airBasedDefai: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

UserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema); 