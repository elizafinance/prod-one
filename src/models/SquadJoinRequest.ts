import mongoose, { Document, Model, Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ISquadJoinRequest extends Document {
  requestId: string; // UUID
  squadId: string; // Aligns with SquadDocument.squadId
  squadName: string; // Denormalized for easier display
  requestingUserWalletAddress: string;
  requestingUserXUsername?: string; // Denormalized
  requestingUserXProfileImageUrl?: string; // Denormalized
  status: 'pending' | 'approved' | 'rejected';
  message?: string; // Optional message from the requester
  createdAt: Date;
  updatedAt: Date;
}

const SquadJoinRequestSchema: Schema<ISquadJoinRequest> = new Schema(
  {
    requestId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
      index: true,
    },
    squadId: {
      type: String,
      required: true,
      index: true,
    },
    squadName: {
      type: String,
      required: true,
    },
    requestingUserWalletAddress: {
      type: String,
      required: true,
      index: true,
    },
    requestingUserXUsername: {
      type: String,
    },
    requestingUserXProfileImageUrl: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
      index: true,
    },
    message: {
      type: String,
      maxlength: 500, // Optional: limit message length
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Indexes to optimize common queries
SquadJoinRequestSchema.index({ squadId: 1, status: 1 }); // For fetching pending requests for a squad
SquadJoinRequestSchema.index({ requestingUserWalletAddress: 1, squadId: 1, status: 1 }); // For checking if user already has a pending request for a squad

export const SquadJoinRequest: Model<ISquadJoinRequest> =
  mongoose.models.SquadJoinRequest ||
  mongoose.model<ISquadJoinRequest>('SquadJoinRequest', SquadJoinRequestSchema); 