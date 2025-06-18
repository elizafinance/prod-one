import mongoose, { Document, Schema } from 'mongoose';

// Squad chat message document
export interface ISquadMessage extends Document {
  squadId: string;
  authorWalletAddress: string;
  content: string;
  epoch: number;
  createdAt: Date;
  createdAtDay: string; // YYYY-MM-DD in UTC
  reactions?: Record<string, string[]>; // emoji -> array of wallet addresses
}

const SquadMessageSchema = new Schema<ISquadMessage>({
  squadId: { type: String, required: true, index: true },
  authorWalletAddress: { type: String, required: true, index: true },
  content: { type: String, required: true, maxlength: 140 },
  epoch: { type: Number, required: true, index: true },
  createdAt: { type: Date, default: Date.now },
  createdAtDay: { type: String, required: true, index: true },
  reactions: { type: Object, default: {} },
});

// Ensure at most 1 message per author per day (UTC) per squad
SquadMessageSchema.index(
  { squadId: 1, authorWalletAddress: 1, createdAtDay: 1 },
  { unique: true }
);

// Pre-save hook to populate createdAtDay based on createdAt
SquadMessageSchema.pre<ISquadMessage>('save', function (next) {
  if (!this.createdAt) {
    this.createdAt = new Date();
  }
  const d = new Date(this.createdAt);
  this.createdAtDay = `${d.getUTCFullYear()}-${(d.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-${d.getUTCDate().toString().padStart(2, '0')}`;
  next();
});

export const SquadMessage =
  mongoose.models.SquadMessage || mongoose.model<ISquadMessage>('SquadMessage', SquadMessageSchema); 