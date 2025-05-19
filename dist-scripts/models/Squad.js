import mongoose, { Schema } from 'mongoose';
const SquadSchema = new Schema({
    squadId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, maxlength: 500 },
    leaderWalletAddress: { type: String, required: true, index: true },
    memberWalletAddresses: [{ type: String, index: true }],
    totalSquadPoints: { type: Number, default: 0, index: true },
    maxMembers: { type: Number },
    tier: { type: Number, index: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
// Update `updatedAt` timestamp on save
SquadSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
export const Squad = mongoose.models.Squad || mongoose.model('Squad', SquadSchema);
