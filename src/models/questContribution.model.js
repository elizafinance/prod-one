import mongoose from 'mongoose';

const questContributionSchema = new mongoose.Schema({
  quest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'CommunityQuest', required: true, index: true },
  user_id: { type: String, required: true, index: true }, // Wallet address of the contributing user
  squad_id: { type: String, index: true, sparse: true, default: null }, // Wallet address or unique ID of the squad, if applicable
  metric_value: { type: Number, required: true, default: 0 }, // e.g., number of referrals, spend amount, 1 for tier reached, squad points contributed
  last_contribution_ts: { type: Date, default: Date.now }, // Timestamp of the last update to this specific contribution
  created_ts: { type: Date, default: Date.now }
});

// Compound index for unique contribution per user (or per user per squad) per quest
// For community quests, squad_id will be null. For squad quests, user_id might be the squad_id itself if contributions are at squad level,
// or user_id is the member and squad_id is specified if we track individual member contributions towards a squad quest.
// Assuming metric_value for squad quests will be directly on the squad, so user_id could be the squad_id itself for contributions.
// Or, user_id is the individual user, and squad_id links it to the squad they were part of when contributing.
// Let's assume for now user_id is always the actual user, and squad_id is their squad affiliation *at the time of contribution* if relevant for the quest scope.
questContributionSchema.index({ quest_id: 1, user_id: 1, squad_id: 1 }, { unique: true, partialFilterExpression: { squad_id: { $ne: null } } });
questContributionSchema.index({ quest_id: 1, user_id: 1 }, { unique: true, partialFilterExpression: { squad_id: null } });

questContributionSchema.pre('save', function(next) {
  this.last_contribution_ts = new Date();
  // If it's a new document, also set created_ts if not already set (though default covers it)
  if (this.isNew && !this.created_ts) {
    this.created_ts = new Date();
  }
  next();
});

questContributionSchema.pre('findOneAndUpdate', function(next) {
  this.set({ last_contribution_ts: new Date() });
  next();
});

const QuestContribution = mongoose.models.QuestContribution || mongoose.model('QuestContribution', questContributionSchema);

export default QuestContribution; 