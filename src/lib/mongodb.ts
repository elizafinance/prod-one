import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

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
  _id?: ObjectId;
  squadId: string;
  name: string;
  description?: string;
  leaderWalletAddress: string;
  memberWalletAddresses: string[];
  totalSquadPoints: number;
  tier?: number;
  maxMembers?: number;
  avatarImageUrl?: string;
  bannerImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  settings?: {
    isPublic?: boolean;
    requiresApproval?: boolean;
  };
}

export interface SquadInvitationDocument {
  _id?: ObjectId;
  invitationId: string;
  squadId: string;
  squadName: string;
  invitedByUserWalletAddress: string;
  invitedUserWalletAddress: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  message?: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export type NotificationType = 
  | 'generic'
  | 'welcome'
  | 'airdrop_claim_available'
  | 'referral_success' // You referred someone
  | 'referred_by_success' // Someone referred you, and you signed up
  | 'quest_completed_community' // A community quest you participated in was completed
  | 'quest_reward_received'   // You received a reward from a community quest
  | 'squad_invite_received'
  | 'squad_invite_accepted'
  | 'squad_invite_declined'
  | 'squad_invite_revoked'
  | 'squad_member_joined'    // When someone (not self) joins your squad
  | 'squad_member_left'      // When someone (not self) leaves your squad
  | 'squad_kicked'           // When you are kicked from a squad
  | 'squad_leader_changed'   // When your squad's leader changes
  | 'squad_disbanded'
  | 'squad_reward_received'  // You received a reward as part of your squad's achievement
  | 'milestone_unlocked'
  | 'badge_earned'
  | 'rank_up'
  | 'system_message';

export interface NotificationDocument {
  _id?: ObjectId;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  ctaUrl?: string;
  isRead: boolean;
  isArchived?: boolean;
  createdAt: Date;
  updatedAt: Date;
  relatedQuestId?: string;
  relatedQuestTitle?: string;
  relatedSquadId?: string;
  relatedSquadName?: string;
  relatedUserId?: string;
  relatedUserName?: string;
  relatedInvitationId?: string;
  rewardAmount?: number;
  rewardCurrency?: string;
  badgeId?: string;
} 