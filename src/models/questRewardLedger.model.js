import mongoose from 'mongoose';

const rewardStatusEnum = ['pending', 'processed', 'failed', 'claimed']; // Added 'claimed' for user-claimable rewards

const questRewardLedgerSchema = new mongoose.Schema({
  quest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityQuest', required: true, index: true },
  user_id: { type: String, required: true, index: true }, // Wallet address of the user receiving the reward
  squad_id: { type: String, index: true, sparse: true, default: null }, // Squad ID if the reward is related to a squad quest/achievement
  
  reward_type: { type: String, required: true }, // e.g., 'points', 'nft_collection_item', 'spl_token', 'badge'
  reward_details: { // Flexible storage for specifics of the reward given
    points_awarded: { type: Number },
    nft_mint_address: { type: String },
    spl_token_mint: { type: String },
    spl_token_amount: { type: Number },
    badge_id: { type: String },
    custom_data: { type: mongoose.Schema.Types.Mixed } // For any other reward types
  },
  reward_description: { type: String }, // User-friendly description of the reward, e.g., "1000 Points from Alpha Quest"
  
  status: { type: String, enum: rewardStatusEnum, default: 'pending', required: true },
  status_reason: { type: String }, // Optional reason if status is 'failed'
  
  distributed_at: { type: Date }, // Timestamp when the reward was processed/sent by the system
  claimed_at: { type: Date }, // Timestamp when user claimed it (if applicable)
  
  transaction_id: { type: String, index: true, sparse: true }, // On-chain transaction ID, if applicable
  
  created_ts: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

questRewardLedgerSchema.index({ quest_id: 1, user_id: 1, reward_type: 1 });
questRewardLedgerSchema.index({ status: 1, reward_type: 1 });

questRewardLedgerSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

questRewardLedgerSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updated_at: new Date() });
  next();
});

const QuestRewardLedger = mongoose.models.QuestRewardLedger || mongoose.model('QuestRewardLedger', questRewardLedgerSchema);

export default QuestRewardLedger; 