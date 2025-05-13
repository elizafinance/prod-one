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
  status: 'active' | 'archived';
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
  status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
});

export const Proposal = mongoose.models.Proposal || mongoose.model<IProposal>('Proposal', ProposalSchema);
export type { IProposal }; 