import mongoose from 'mongoose';

const questRewardLedgerSchema = new mongoose.Schema({
  quest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityQuest', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reward_type: {
    type: String,
    enum: ['points', 'nft'],
    required: true,
  },
  reward_details: { type: mongoose.Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: ['pending', 'issued', 'claimed', 'failed'],
    default: 'issued',
  },
}, { timestamps: { createdAt: 'issued_ts' } });

questRewardLedgerSchema.index({ quest_id: 1, user_id: 1, reward_type: 1 }, { unique: true });
questRewardLedgerSchema.index({ user_id: 1, issued_ts: -1 });

export default mongoose.models.QuestRewardLedger || mongoose.model('QuestRewardLedger', questRewardLedgerSchema); 