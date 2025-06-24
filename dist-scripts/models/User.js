import mongoose, { Schema } from 'mongoose';
const UserSchema = new Schema({
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
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
UserSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
