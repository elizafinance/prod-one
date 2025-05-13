import mongoose from 'mongoose';

const communityQuestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description_md: { type: String, required: true },
  goal_type: {
    type: String,
    enum: ['total_referrals', 'users_at_tier', 'aggregate_spend'],
    required: true,
  },
  goal_target_metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  goal_target: { type: Number, required: true },
  reward_type: {
    type: String,
    enum: ['points', 'nft', 'points+nft'],
    required: true,
  },
  reward_points: { type: Number },
  reward_nft_id: { type: String },
  start_ts: { type: Date, required: true },
  end_ts: { type: Date, required: true },
  status: {
    type: String,
    enum: ['scheduled', 'active', 'succeeded', 'failed', 'expired'],
    default: 'scheduled',
    index: true,
  },
  created_by: { type: String, comment: "Identifier for the admin who created the quest" },
}, { timestamps: { createdAt: 'created_ts', updatedAt: 'updated_ts' } });

communityQuestSchema.index({ goal_type: 1, status: 1, end_ts: 1 });

const goalTypeEnum = ['total_referrals', 'users_at_tier', 'aggregate_spend'];
communityQuestSchema.path('goal_type', { type: String, enum: goalTypeEnum, required: true });

export default mongoose.models.CommunityQuest || mongoose.model('CommunityQuest', communityQuestSchema); 