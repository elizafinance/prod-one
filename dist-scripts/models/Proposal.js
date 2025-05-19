import mongoose, { Schema } from 'mongoose';
const ProposalSchema = new Schema({
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
export const Proposal = mongoose.models.Proposal || mongoose.model('Proposal', ProposalSchema);
