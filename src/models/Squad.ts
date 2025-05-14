import mongoose, { Document, Schema, Types } from 'mongoose';

// Replicating the SquadDocument interface from mongodb.ts for the Mongoose model
interface ISquad extends Document {
  squadId: string; // Unique identifier for the squad
  name: string; // Name of the squad, should ideally be unique
  description?: string;
  leaderWalletAddress: string; // Wallet address of the squad leader
  memberWalletAddresses: string[]; // Array of wallet addresses of squad members
  totalSquadPoints: number;
  maxMembers?: number; // Maximum number of members allowed in this squad
  tier?: number; // Tier level of the squad (1, 2, or 3)
  createdAt: Date;
  updatedAt: Date;
}

const SquadSchema = new Schema<ISquad>({
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
SquadSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Squad = mongoose.models.Squad || mongoose.model<ISquad>('Squad', SquadSchema);
export type { ISquad }; 