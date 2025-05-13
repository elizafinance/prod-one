import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

if (!MONGODB_DB_NAME) {
  throw new Error('Please define the MONGODB_DB_NAME environment variable inside .env.local');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
interface CachedMongoConnection {
  client: MongoClient | null;
  db: Db | null;
}

// Extend the NodeJS Global type with our cached connection interface
declare global {
  var mongo: CachedMongoConnection | undefined;
}

let cached: CachedMongoConnection = global.mongo || { client: null, db: null };

if (!global.mongo) {
  global.mongo = cached;
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cached.client && cached.db) {
    return cached as { client: MongoClient; db: Db };
  }

  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined');
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB_NAME);

  cached.client = client;
  cached.db = db;

  return cached as { client: MongoClient; db: Db };
}

// Example of how you might define a User interface (adapt as needed)
export interface UserDocument {
  _id?: any;
  walletAddress?: string;
  xUserId: string;
  xUsername?: string;
  xProfileImageUrl?: string;
  points: number;
  referralCode?: string;
  referredBy?: string;
  completedActions?: string[];
  highestAirdropTierLabel?: string;
  referralsMadeCount?: number;
  activeReferralBoosts?: ReferralBoost[];
  squadId?: string; // ID of the squad the user belongs to
  earnedBadgeIds?: string[]; // New field for storing earned badge identifiers
  createdAt?: Date;
  updatedAt?: Date;
  current_tier_name?: string;
  tier_updated_at?: Date;
}

export interface ReferralBoost {
  boostId: string;
  type: 'percentage_bonus_referrer';
  value: number;
  remainingUses: number;
  description: string;
}

// Example of how you might define an Action interface
export interface ActionDocument {
  _id?: any;
  walletAddress: string;
  actionType: string; // e.g., 'shared_on_x', 'followed_on_x', 'referral_signup'
  pointsAwarded: number;
  timestamp?: Date;
  notes?: string;
}

export interface SquadDocument {
  _id?: any;
  squadId: string; // Unique identifier for the squad
  name: string; // Name of the squad, should ideally be unique
  description?: string;
  leaderWalletAddress: string; // Wallet address of the squad leader
  memberWalletAddresses: string[]; // Array of wallet addresses of squad members
  totalSquadPoints: number;
  maxMembers?: number; // Maximum number of members allowed in this squad
  tier?: number; // Tier level of the squad (1, 2, or 3)
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SquadInvitationDocument {
  _id?: any;
  invitationId: string; // Unique ID for the invitation
  squadId: string;       // ID of the squad inviting
  squadName: string;     // Name of the squad (for display in invite)
  invitedByUserWalletAddress: string; // Wallet address of the user who sent the invite (e.g., squad leader)
  invitedUserWalletAddress: string; // Wallet address of the user being invited
  status: 'pending' | 'accepted' | 'declined' | 'revoked'; // Status of the invitation
  createdAt?: Date;
  // expiresAt?: Date; // Optional: for time-limited invites, can be added later
  updatedAt?: Date; // To track when the status last changed
}

export type NotificationType =
  | 'squad_invite_received'
  | 'squad_invite_accepted'
  | 'squad_invite_declined'
  | 'squad_invite_revoked'
  | 'squad_member_joined'    // When someone (not self) joins your squad
  | 'squad_member_left'      // When someone (not self) leaves your squad
  | 'squad_kicked'           // When you are kicked from a squad
  | 'squad_leader_changed'   // When your squad's leader changes
  | 'squad_disbanded'
  // Community Quest Notifications
  | 'quest_reward_received' // User received a reward from a completed quest
  | 'quest_newly_active'    // A new quest has become active (general notification, or targeted later)
  | 'quest_completed_community' // A quest the user participated in was completed by the community
  | 'quest_failed_community';   // A quest the user participated in failed or expired

export interface NotificationDocument {
  _id?: any;
  notificationId: string; // Unique ID for the notification
  recipientWalletAddress: string; // The user who should receive this notification
  type: NotificationType;
  message: string; // User-friendly message, e.g., "@UserX invited you to join Squad Y!"
  relatedQuestId?: string; // Link to the quest
  relatedQuestTitle?: string; // For easier display
  reward_details_summary?: string; // e.g., "+500 Points", "Special NFT Unlocked!"
  relatedSquadId?: string;
  relatedSquadName?: string; // For easier display without extra lookup
  relatedUserWalletAddress?: string; // e.g., who sent invite, who joined/left
  relatedUserXUsername?: string; // For easier display
  relatedInvitationId?: string; // For squad invitations to store the invitation ID
  isRead: boolean;
  createdAt?: Date;
} 