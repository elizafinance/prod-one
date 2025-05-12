import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, ActionDocument, ReferralBoost, SquadDocument } from '@/lib/mongodb';
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
    const squadsCollection = db.collection<SquadDocument>('squads');

    let user = await usersCollection.findOne({ walletAddress });
    let airdropAmount = 0;
    const airdropEntry = typedAirdropData.find(item => item.Account === walletAddress);
    if (airdropEntry) {
      airdropAmount = airdropEntry.AIRDROP;
    }

    let currentPoints = 0;
    let pointsGainedThisSession = 0;
    let currentReferralCode: string | undefined = undefined;
    let currentCompletedActions: string[] = [];

    if (!user) {
      // New user: Create them
      const newReferralCode = await generateUniqueReferralCode(db);
      currentPoints = POINTS_INITIAL_CONNECTION;
      pointsGainedThisSession += POINTS_INITIAL_CONNECTION;
      currentCompletedActions.push('initial_connection');

      currentPoints += CONNECT_WALLET_POINTS;
      pointsGainedThisSession += CONNECT_WALLET_POINTS;
      currentCompletedActions.push(CONNECT_WALLET_ACTION_ID);

      const newUserDocData: Omit<UserDocument, '_id'> = {
        walletAddress,
        xUserId: walletAddress,
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

      await actionsCollection.insertOne({
        walletAddress,
        actionType: 'initial_connection',
        pointsAwarded: POINTS_INITIAL_CONNECTION,
        timestamp: new Date(),
      });

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

      if (!currentCompletedActions.includes('initial_connection')) {
        console.log(`[Activate Rewards] Existing user ${walletAddress} missing initial_connection. Adding.`);
        currentPoints += POINTS_INITIAL_CONNECTION;
        pointsGainedThisSession += POINTS_INITIAL_CONNECTION;
        currentCompletedActions.push('initial_connection');
        await actionsCollection.insertOne({
          walletAddress,
          actionType: 'initial_connection',
          pointsAwarded: POINTS_INITIAL_CONNECTION,
          timestamp: new Date(),
          notes: 'Initial connection for existing wallet (activate-rewards)'
        });
      }

      if (!currentCompletedActions.includes(CONNECT_WALLET_ACTION_ID)) {
        console.log(`[Activate Rewards] Existing user ${walletAddress} first time wallet connect. Adding points.`);
        currentPoints += CONNECT_WALLET_POINTS;
        pointsGainedThisSession += CONNECT_WALLET_POINTS;
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
      } else {
        currentReferralCode = user.referralCode;
      }
    }

    // Award points for airdrop amount thresholds
    if (airdropAmount > 0) {
      for (const threshold of AIRDROP_THRESHOLDS) {
        if (airdropAmount >= threshold.amount && !currentCompletedActions.includes(threshold.tier_action_id)) {
          currentPoints += threshold.points;
          pointsGainedThisSession += threshold.points;
          currentCompletedActions.push(threshold.tier_action_id);
          await actionsCollection.insertOne({
            walletAddress,
            actionType: threshold.tier_action_id,
            pointsAwarded: threshold.points,
            timestamp: new Date(),
          });
        }
      }
    }

    // Update squad points if user is in a squad and gained points this session
    const finalUserForSquadCheck = await usersCollection.findOne({ walletAddress });
    if (finalUserForSquadCheck?.squadId && pointsGainedThisSession > 0) {
      await squadsCollection.updateOne(
        { squadId: finalUserForSquadCheck.squadId },
        { 
          $inc: { totalSquadPoints: pointsGainedThisSession },
          $set: { updatedAt: new Date() }
        }
      );
      console.log(`Updated squad ${finalUserForSquadCheck.squadId} points by ${pointsGainedThisSession}`);
    }

    // Determine the user's highest airdrop tier label
    let userHighestAirdropTierLabel: string | undefined = undefined;
    for (const threshold of AIRDROP_THRESHOLDS) {
      if (currentCompletedActions.includes(threshold.tier_action_id)) {
        userHighestAirdropTierLabel = threshold.tier_action_id.replace('airdrop_tier_', '');
        userHighestAirdropTierLabel = userHighestAirdropTierLabel.charAt(0).toUpperCase() + userHighestAirdropTierLabel.slice(1);
        break;
      }
    }

    await usersCollection.updateOne(
      { walletAddress }, 
      { $set: { 
          points: currentPoints, 
          completedActions: currentCompletedActions, 
          referralCode: currentReferralCode,
          highestAirdropTierLabel: userHighestAirdropTierLabel,
          updatedAt: new Date() 
        } 
      },
      { upsert: true }
    );

    const finalUser = await usersCollection.findOne({ walletAddress });

    return NextResponse.json({
      message: user ? 'Rewards activated/updated.' : 'User created and rewards activated.',
      points: finalUser?.points || currentPoints,
      referralCode: finalUser?.referralCode || currentReferralCode,
      completedActions: finalUser?.completedActions || currentCompletedActions,
      airdropAmount: airdropAmount, 
      activeReferralBoosts: finalUser?.activeReferralBoosts || [],
      referralsMadeCount: finalUser?.referralsMadeCount || 0,
      xUsername: finalUser?.xUsername,
      highestAirdropTierLabel: finalUser?.highestAirdropTierLabel
    });

  } catch (error) {
    console.error("Error activating rewards:", error);
    return NextResponse.json({ error: 'Failed to activate rewards' }, { status: 500 });
  }
} 