import mongoose from 'mongoose';
const questStatusEnum = ['draft', 'scheduled', 'active', 'paused', 'succeeded', 'failed', 'expired', 'archived'];
const goalTypeEnum = [
    'total_referrals', // Community: Total referrals made by all participants
    'users_at_tier', // Community: Number of unique users reaching a specific tier
    'aggregate_spend', // Community: Total spend (e.g., SOL, USDC) by all participants
    'total_squad_points', // Squad: Total points accumulated by a squad
    'squad_meetup' // Squad: Two or more members meet up in person
];
const questScopeEnum = ['community', 'squad'];
const rewardSplitEnum = ['equal', 'leader_only', 'proportional', 'none']; // 'none' if rewards are manual or handled by a generic 'quest_succeeded' event
const communityQuestSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: questStatusEnum, default: 'draft', required: true },
    scope: { type: String, enum: questScopeEnum, default: 'community', required: true },
    goal_type: { type: String, enum: goalTypeEnum, required: true },
    goal_target: { type: Number, required: true }, // e.g., 1000 referrals, 50 users, 100000 spend, 50000 squad points, 2 members for meetup
    goal_target_metadata: {
        tier_name: { type: String }, // For 'users_at_tier'
        currency: { type: String }, // For 'aggregate_spend', e.g., 'SOL', 'USDC', 'POINTS'
        // For 'squad_meetup'
        proximity_meters: { type: Number },
        time_window_minutes: { type: Number },
        // Add other metadata as needed for future quest types
    },
    start_ts: { type: Date, required: true },
    end_ts: { type: Date, required: true },
    rewards: [{
            type: { type: String, required: true }, // e.g., 'points', 'nft_collection', 'spl_token', 'badge', 'custom'
            value: { type: mongoose.Schema.Types.Mixed, required: true }, // e.g., 1000 (points), 'CollectionMintAddress', { tokenMint: 'TokenMint', amount: 100 }, 'BadgeID'
            description: { type: String }
        }],
    reward_split: { type: String, enum: rewardSplitEnum, default: 'none' }, // Relevant for scope: 'squad'
    // Admin fields
    created_by: { type: String }, // Changed from ObjectId to String to store adminIdentifier directly
    updated_by: { type: String }, // Assuming updated_by should also be String if it follows the same pattern
    // Soft delete
    deleted_at: { type: Date, default: null },
    // Timestamps
    created_ts: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});
communityQuestSchema.index({ status: 1, start_ts: 1, end_ts: 1 });
communityQuestSchema.index({ goal_type: 1, status: 1 });
communityQuestSchema.index({ scope: 1, status: 1 });
// Pre-save hook to update `updated_at`
communityQuestSchema.pre('save', function (next) {
    this.updated_at = new Date();
    next();
});
communityQuestSchema.pre('findOneAndUpdate', function (next) {
    this.set({ updated_at: new Date() });
    next();
});
const CommunityQuest = mongoose.models.CommunityQuest || mongoose.model('CommunityQuest', communityQuestSchema);
export default CommunityQuest;
