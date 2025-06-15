import { MongoClient, Db } from 'mongodb';

/**
 * Cached connection across hot-reloads in development so that we don't create
 * new connections every time Next.js refreshes the server.
 */
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('Environment variable MONGODB_URI must be defined');
}

const MONGODB_DB = process.env.MONGODB_DB; // optional, falls back to default DB in URI

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI as string);
  await client.connect();
  const db = client.db(MONGODB_DB);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

/* -------------------------------------------------------------------------- */
/*                             Re-exported types                              */
/* -------------------------------------------------------------------------- */
// These are light-weight interfaces that many API routes use for typing. They
// are NOT strict schemas – feel free to replace them with imports from your
// Mongoose models if you need richer typing.

export interface UserDocument {
  _id?: any;
  walletAddress: string;
  points?: number;
  [key: string]: any;
}

export interface SquadDocument {
  _id?: any;
  squadId: string;
  name: string;
  memberWalletAddresses: string[];
  [key: string]: any;
}

export interface ActionDocument {
  _id?: any;
  actionType: string;
  walletAddress: string;
  [key: string]: any;
}

export interface NotificationDocument {
  _id?: any;
  recipient: string;
  type: string;
  title: string;
  body: string;
  [key: string]: any;
}

export interface SquadInvitationDocument {
  _id?: any;
  squadId: string;
  inviterWalletAddress: string;
  inviteeWalletAddress: string;
  status: string;
  [key: string]: any;
}

export interface ReferralBoost {
  boostId?: string;              // Unique identifier for the boost
  boostType: string;             // e.g. percentage_bonus_referrer
  value?: number;                // Numeric value of the boost (percentage, points, etc.)
  remainingUses?: number;        // How many times the boost can still be applied
  description?: string;          // Human-readable description
  expiresAt?: Date;              // Optional expiry timestamp
  activatedAt?: Date;            // When the boost became active
  [key: string]: any;            // Allow for future extension without compile errors
}

// ---------------------------------------------------------------------------
// Notification related lightweight typings
// ---------------------------------------------------------------------------
// A simple alias so that other modules can import `NotificationType` without
// enforcing a strict string union (which would require keeping this file in
// lock-step with every place a new notification constant is added). If you
// want stronger typing, replace this with a union of literal strings.

export type NotificationType = string;

export interface MeetupCheckInDocument {
  _id?: any;                     // MongoDB ObjectId
  questId: any;                  // ObjectId reference to the CommunityQuest
  squadId: string;               // The squad's identifier
  userId: string;                // The user's DB _id (string)
  walletAddress: string;         // The user's public Solana wallet address (base58)
  latitude: number;              // Latitude captured at check-in
  longitude: number;             // Longitude captured at check-in
  accuracy: number;              // Reported accuracy in meters
  clientTimestamp: Date;         // When the check-in was created on the client
  serverTimestamp: Date;         // When the server received the check-in
  signedMessage: string;         // The canonical message that was signed
  signature: string;             // Base64 encoded signature string
  status: 'pending_match' | 'matched' | string; // Current processing state
  matchGroupId?: string;         // Identifier of the matched meetup group, if any
  [key: string]: any;            // Allow additional extensible fields
}

export interface ISquadJoinRequest {
  _id?: any;                     // MongoDB ObjectId
  requestId: string;             // UUID for the request
  squadId: string;               // Squad identifier (string)
  squadName: string;             // Denormalized squad name for convenience
  requestingUserWalletAddress: string;
  requestingUserXUsername?: string;
  requestingUserXProfileImageUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  message?: string;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}