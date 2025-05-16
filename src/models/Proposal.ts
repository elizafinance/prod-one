import mongoose, { Document, Schema, Types } from 'mongoose';

interface IProposal extends Document {
  squadId: Types.ObjectId;
  squadName: string; // Cached for easier display
  createdByUserId: Types.ObjectId;
  tokenContractAddress: string;
  tokenName: string;
  reason: string;
  createdAt: Date;
  epochStart: Date;
  epochEnd: Date;
  broadcasted: boolean;
  status: 'active' | 'closed_passed' | 'closed_failed' | 'closed_executed' | 'archived' | 'cancelled';
  // Fields for vote results - to be populated by the cron job
  finalUpVotesWeight?: number;
  finalDownVotesWeight?: number;
  finalAbstainVotesCount?: number;
  totalFinalVoters?: number;
  finalUpVotesCount?: number;
  finalDownVotesCount?: number;
  slug?: string; // Unique slug/hash identifier for friendly URLs
}

const ProposalSchema = new Schema<IProposal>({
  squadId: { type: Schema.Types.ObjectId, ref: 'Squad', required: true, index: true },
  squadName: { type: String, required: true },
  createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenContractAddress: { type: String, required: true, trim: true },
  tokenName: { type: String, required: true, trim: true, maxlength: 50 },
  reason: { type: String, required: true, trim: true, maxlength: 140 },
  createdAt: { type: Date, default: Date.now },
  epochStart: { type: Date, required: true, index: true },
  epochEnd: { type: Date, required: true, index: true },
  broadcasted: { type: Boolean, default: false },
  status: { 
    type: String, 
    enum: ['active', 'closed_passed', 'closed_failed', 'closed_executed', 'archived', 'cancelled'], 
    default: 'active', 
    index: true 
  },
  // Fields for vote results
  finalUpVotesWeight: { type: Number, default: 0 },
  finalDownVotesWeight: { type: Number, default: 0 },
  finalAbstainVotesCount: { type: Number, default: 0 },
  totalFinalVoters: { type: Number, default: 0 },
  finalUpVotesCount: { type: Number, default: 0 },
  finalDownVotesCount: { type: Number, default: 0 },
  slug: { type: String, required: false, trim: true, unique: true, sparse: true },
});

export const Proposal = mongoose.models.Proposal || mongoose.model<IProposal>('Proposal', ProposalSchema);
export type { IProposal }; 