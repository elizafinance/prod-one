import { MongoClient, Db, Collection, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME;

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
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  if (!MONGODB_DB_NAME) {
    throw new Error('MONGODB_DB_NAME environment variable is not defined');
  }

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB_NAME);

  cached.client = client;
  cached.db = db;

  return cached as { client: MongoClient; db: Db };
}

export interface UserDocument {
  _id?: ObjectId; // Prefer ObjectId, but main had 'any'
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
  squadId?: string; 
  earnedBadgeIds?: string[];
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

export interface ActionDocument {
  _id?: ObjectId; // Prefer ObjectId
  walletAddress: string;
  actionType: string; 
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
  totalSquadPoints: number; // Kept from squad-goals for quest engine
  tier?: number; 
  maxMembers?: number;
  avatarImageUrl?: string; // From squad-goals (could be profile)
  bannerImageUrl?: string; // From squad-goals
  profileImageUrl?: string; // From HEAD (distinct from avatar?)
  tags?: string[]; // From HEAD
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt?: Date; // From HEAD
  settings?: { // From squad-goals, incorporating HEAD's fields
    isPublic?: boolean; // isPrivate from HEAD would be !isPublic
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
  | 'referral_success' 
  | 'referred_by_success' 
  | 'quest_completed_community'
  | 'quest_reward_received'   
  | 'squad_invite_received'
  | 'squad_invite_accepted'
  | 'squad_invite_declined'
  | 'squad_invite_revoked'
  | 'squad_member_joined'    
  | 'squad_member_left'      
  | 'squad_kicked'           
  | 'squad_leader_changed'   
  | 'squad_disbanded'        
  | 'squad_join_request_received' 
  | 'squad_join_request_approved' 
  | 'squad_join_request_rejected' 
  | 'squad_reward_received'  
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

// Assuming ISquadJoinRequest and its model file exist as per HEAD branch
// If SquadJoinRequest.ts doesn't exist or is not intended, this line should be removed.
export type { ISquadJoinRequest } from '@/models/SquadJoinRequest';
