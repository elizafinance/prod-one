import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, ActionDocument } from '@/lib/mongodb';
import airdropDataList from '@/data/airdropData.json'; // For checking airdrop amount
import { randomBytes } from 'crypto';
import { Db } from 'mongodb';

interface AirdropGsheetEntry {
  Account: string;
  "Token Account": string;
  Quantity: number | string;
  AIRDROP: number;
}
const typedAirdropData = airdropDataList as AirdropGsheetEntry[];

const POINTS_INITIAL_CONNECTION = 100;
const POINTS_REFERRAL_BONUS_FOR_REFERRER = 20;
const CONNECT_WALLET_POINTS = 100;
const CONNECT_WALLET_ACTION_ID = 'wallet_connected_first_time';
// const POINTS_FOR_BEING_REFERRED = 10; // Optional

const AIRDROP_THRESHOLDS = [
  { amount: 1000000000, points: 10000, tier_action_id: 'airdrop_tier_legend' },    // New: 1B AIR
  { amount: 500000000, points: 5000, tier_action_id: 'airdrop_tier_grandmaster' }, // New: 500M AIR
  { amount: 100000000, points: 1000, tier_action_id: 'airdrop_tier_master' },     // New: 100M AIR
  { amount: 10000000, points: 500, tier_action_id: 'airdrop_tier_diamond' },      // New: 10M AIR
  { amount: 1000000, points: 300, tier_action_id: 'airdrop_tier_gold' },
  { amount: 100000, points: 150, tier_action_id: 'airdrop_tier_silver' },
  { amount: 10000, points: 50, tier_action_id: 'airdrop_tier_bronze' },
];

async function generateUniqueReferralCode(db: Db, length = 8): Promise<string> {
  const usersCollection = db.collection<UserDocument>('users');
  let referralCode = '';
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;
  while (!isUnique && attempts < maxAttempts) {
    referralCode = randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
    const existingUser = await usersCollection.findOne({ referralCode });
    if (!existingUser) {
      isUnique = true;
    }
    attempts++;
  }
  if (!isUnique) {
    console.warn(`Could not generate unique referral code after ${maxAttempts} attempts. Appending random chars.`);
    return referralCode + randomBytes(2).toString('hex'); 
  }
  return referralCode;
}

interface ActivateRequestBody {
  walletAddress: string;
  referrerCodeFromQuery?: string | null;
}

export async function POST(request: Request) {
  try {
    const body: ActivateRequestBody = await request.json();
    const { walletAddress, referrerCodeFromQuery } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const actionsCollection = db.collection<ActionDocument>('actions');

    let user = await usersCollection.findOne({ walletAddress });
    let airdropAmount = 0;
    const airdropEntry = typedAirdropData.find(item => item.Account === walletAddress);
    if (airdropEntry) {
      airdropAmount = airdropEntry.AIRDROP;
    }

    let currentPoints = 0;
    let currentReferralCode: string | undefined = undefined; // Ensure type consistency
    let currentCompletedActions: string[] = [];

    if (!user) {
      // New user: Create them
      const newReferralCode = await generateUniqueReferralCode(db);
      currentPoints = POINTS_INITIAL_CONNECTION; // Base points for initial connection
      currentCompletedActions.push('initial_connection');

      // Add points for first wallet connection
      currentPoints += CONNECT_WALLET_POINTS;
      currentCompletedActions.push(CONNECT_WALLET_ACTION_ID);

      const newUserDocData: Omit<UserDocument, '_id'> = { // Use Omit to satisfy type for insertOne
        walletAddress,
        xUserId: walletAddress, // Assuming walletAddress can serve as xUserId
        points: currentPoints,
        referralCode: newReferralCode,
        completedActions: currentCompletedActions,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (referrerCodeFromQuery) {
        const referrer = await usersCollection.findOne({ referralCode: referrerCodeFromQuery });
        if (referrer && referrer.walletAddress !== walletAddress) {
          if (!referrer.walletAddress) {
            console.error(`Referrer with code ${referrerCodeFromQuery} found but has no walletAddress during reward activation.`);
          } else {
            (newUserDocData as UserDocument).referredBy = referrer.walletAddress;
            await usersCollection.updateOne(
              { walletAddress: referrer.walletAddress },
              { $inc: { points: POINTS_REFERRAL_BONUS_FOR_REFERRER }, $set: { updatedAt: new Date() } }
            );
            await actionsCollection.insertOne({
              walletAddress: referrer.walletAddress,
              actionType: 'referral_bonus',
              pointsAwarded: POINTS_REFERRAL_BONUS_FOR_REFERRER,
              timestamp: new Date(),
              notes: `Referred ${walletAddress}`
            });
          }
        }
      }
      const insertResult = await usersCollection.insertOne(newUserDocData as UserDocument);
      user = await usersCollection.findOne({ _id: insertResult.insertedId }); 
      
      if (!user) { 
        throw new Error("Failed to create and retrieve new user after insert.");
      }
      // user is now the full document from DB, currentPoints and currentReferralCode already set for new user

      await actionsCollection.insertOne({
        walletAddress,
        actionType: 'initial_connection',
        pointsAwarded: POINTS_INITIAL_CONNECTION,
        timestamp: new Date(),
      });

      // Log the new wallet connection action for new user
      await actionsCollection.insertOne({
        walletAddress,
        actionType: CONNECT_WALLET_ACTION_ID,
        pointsAwarded: CONNECT_WALLET_POINTS,
        timestamp: new Date(),
        notes: 'First wallet connection (new user)'
      });

    } else {
      // Existing user
      currentPoints = user.points || 0;
      currentCompletedActions = user.completedActions || [];

      // Ensure initial_connection points if missing for this existing wallet-based user
      if (!currentCompletedActions.includes('initial_connection')) {
        console.log(`[Activate Rewards] Existing user ${walletAddress} missing initial_connection. Adding.`);
        currentPoints += POINTS_INITIAL_CONNECTION;
        currentCompletedActions.push('initial_connection');
        await actionsCollection.insertOne({
          walletAddress,
          actionType: 'initial_connection',
          pointsAwarded: POINTS_INITIAL_CONNECTION,
          timestamp: new Date(),
          notes: 'Initial connection for existing wallet (activate-rewards)'
        });
      }

      // Award points for first wallet connection if not already done
      if (!currentCompletedActions.includes(CONNECT_WALLET_ACTION_ID)) {
        console.log(`[Activate Rewards] Existing user ${walletAddress} first time wallet connect. Adding points.`);
        currentPoints += CONNECT_WALLET_POINTS;
        currentCompletedActions.push(CONNECT_WALLET_ACTION_ID);
        await actionsCollection.insertOne({
          walletAddress,
          actionType: CONNECT_WALLET_ACTION_ID,
          pointsAwarded: CONNECT_WALLET_POINTS,
          timestamp: new Date(),
          notes: 'First wallet connection bonus (existing user)'
        });
      }

      if (!user.referralCode) {
        currentReferralCode = await generateUniqueReferralCode(db); 
        // The update for this referralCode will happen in the final updateOne
      } else {
        currentReferralCode = user.referralCode;
      }
    }

    // Award points for airdrop amount thresholds (only once)
    if (airdropAmount > 0) {
      for (const threshold of AIRDROP_THRESHOLDS) {
        if (airdropAmount >= threshold.amount && !currentCompletedActions.includes(threshold.tier_action_id)) {
          currentPoints += threshold.points;
          if (!currentCompletedActions.includes(threshold.tier_action_id)) { // Double check before pushing
            currentCompletedActions.push(threshold.tier_action_id);
          }
          await actionsCollection.insertOne({
            walletAddress,
            actionType: threshold.tier_action_id,
            pointsAwarded: threshold.points,
            timestamp: new Date(),
          });
          // break; // Removed to award points for all qualified tiers
        }
      }
    }

    // Determine the user's highest airdrop tier label
    let userHighestAirdropTierLabel: string | undefined = undefined;
    for (const threshold of AIRDROP_THRESHOLDS) { // AIRDROP_THRESHOLDS is sorted highest to lowest
      if (currentCompletedActions.includes(threshold.tier_action_id)) {
        // Extract a user-friendly label, e.g., "Legend" from "airdrop_tier_legend"
        userHighestAirdropTierLabel = threshold.tier_action_id.replace('airdrop_tier_', '');
        userHighestAirdropTierLabel = userHighestAirdropTierLabel.charAt(0).toUpperCase() + userHighestAirdropTierLabel.slice(1);
        break; // Found the highest tier
      }
    }

    await usersCollection.updateOne(
      { walletAddress }, 
      { $set: { 
          points: currentPoints, 
          completedActions: currentCompletedActions, 
          referralCode: currentReferralCode, // Ensure referral code is saved if newly generated for existing user
          highestAirdropTierLabel: userHighestAirdropTierLabel, // Store the tier label
          updatedAt: new Date() 
        } 
      },
      { upsert: true } // Ensure user is created if somehow missed in the initial check (defensive)
    );

    return NextResponse.json({
      message: user ? 'Rewards activated/updated.' : 'User created and rewards activated.',
      points: currentPoints,
      referralCode: currentReferralCode,
      completedActions: currentCompletedActions,
      airdropAmount: airdropAmount 
    });

  } catch (error) {
    console.error("Error activating rewards:", error);
    return NextResponse.json({ error: 'Failed to activate rewards' }, { status: 500 });
  }
} 