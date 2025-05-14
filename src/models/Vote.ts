import mongoose, { Document, Schema, Types } from 'mongoose';

interface IVote extends Document {
  proposalId: Types.ObjectId;
  voterUserId: Types.ObjectId;
  voterWallet: string;
  squadId: Types.ObjectId; // Denormalized for easier squad-based queries if needed
  choice: 'up' | 'down' | 'abstain';
  voterPointsAtCast: number;
  createdAt: Date;
}

const VoteSchema = new Schema<IVote>({
  proposalId: { type: Schema.Types.ObjectId, ref: 'Proposal', required: true, index: true },
  voterUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  voterWallet: { type: String, required: true, index: true }, // Indexed for potential lookups by wallet
  squadId: { type: Schema.Types.ObjectId, ref: 'Squad', required: true },
  choice: { type: String, enum: ['up', 'down', 'abstain'], required: true },
  voterPointsAtCast: { type: Number, required: true, min: 0 },
  createdAt: { type: Date, default: Date.now },
});

// Compound index to ensure a user can vote only once per proposal
VoteSchema.index({ proposalId: 1, voterUserId: 1 }, { unique: true });

export const Vote = mongoose.models.Vote || mongoose.model<IVote>('Vote', VoteSchema);
export type { IVote }; 