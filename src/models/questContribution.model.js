import mongoose from 'mongoose';

const questContributionSchema = new mongoose.Schema({
  quest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityQuest', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  metric_value: { type: Number, required: true, default: 0 },
}, { timestamps: { createdAt: 'created_ts', updatedAt: 'last_updated_ts' } });

questContributionSchema.index({ quest_id: 1, user_id: 1 }, { unique: true });
questContributionSchema.index({ quest_id: 1, metric_value: -1 });

export default mongoose.models.QuestContribution || mongoose.model('QuestContribution', questContributionSchema); 