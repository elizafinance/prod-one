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
  walletAddress: string; // This is the Solana wallet address
  xUserId?: string;       // This is the X/Twitter User ID from session
  userDbId?: string;      // This is the DB ID from session (optional, xUserId is primary)
  referrerCodeFromQuery?: string | null;
}

export async function POST(request: Request) {
  try {
    const body: ActivateRequestBody = await request.json();
    // Destructure all potential fields from the body
    const { walletAddress, xUserId, userDbId, referrerCodeFromQuery } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }
    // It's crucial that xUserId is present if we are trying to link a wallet to an existing X login
    // For a brand new user who might only connect wallet without X, xUserId might be absent.
    // However, the flow from page.tsx implies X login happens first or concurrently.

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const actionsCollection = db.collection<ActionDocument>('actions');
    const squadsCollection = db.collection<SquadDocument>('squads');

    let user: UserDocument | null = null;

    if (xUserId) {
      console.log(`[Activate Rewards] Attempting to find user by xUserId: ${xUserId}`);
      user = await usersCollection.findOne({ xUserId });
      if (user) {
        console.log(`[Activate Rewards] Found user by xUserId. Current walletAddress in DB: ${user.walletAddress}. Will update/link to new Solana wallet: ${walletAddress}`);
        // If the found user's walletAddress is different from the new Solana walletAddress,
        // it means we are linking/updating the wallet for the X-authenticated user.
        // Or if their walletAddress was the xUserId itself.
        if (user.walletAddress !== walletAddress) {
          // Update this existing user's walletAddress to the new Solana one
          // We also need to ensure their xUserId remains their Twitter ID.
          // The rest of the logic will then apply to this 'user' object.
          console.log(`[Activate Rewards] Updating walletAddress for user ${xUserId} from ${user.walletAddress} to ${walletAddress}`);
          // We will update the walletAddress field later in the common updateOne call
        }
      } else {
        console.log(`[Activate Rewards] No user found by xUserId: ${xUserId}. Will proceed to check by Solana walletAddress or create new.`);
      }
    }

    if (!user) { // If not found by xUserId, try by the Solana walletAddress
      console.log(`[Activate Rewards] User not found by xUserId or xUserId not provided. Attempting to find by walletAddress: ${walletAddress}`);
      user = await usersCollection.findOne({ walletAddress });
      if (user) {
        console.log(`[Activate Rewards] Found user by walletAddress: ${walletAddress}. Their xUserId in DB is: ${user.xUserId}`);
        // If this user was found by Solana wallet, ensure their xUserId is consistent if possible.
        // This case might be complex if an xUserId was also provided and didn't match.
        // For now, we prioritize the user found by xUserId if xUserId was provided.
        // If only walletAddress was used for lookup and found a user, their existing xUserId should be preserved unless xUserId was provided in request and is different.
        if (xUserId && user.xUserId !== xUserId) {
          console.warn(`[Activate Rewards] Conflict: User found by wallet ${walletAddress} has xUserId ${user.xUserId}, but request included different xUserId ${xUserId}. Prioritizing record found by walletAddress for now, but this indicates a potential issue.`);
          // Decide on a merge strategy or error handling if this state is problematic.
          // For now, we'll use the user found by walletAddress and overwrite their xUserId if the new xUserId is provided and different.
           // This ensures the session's xUserId becomes the primary if the wallet was perhaps previously linked to a different/no xId
           // user.xUserId = xUserId; // Make sure to include this in the $set if we decide to update xUserId here
        }
      }
    }
    
    let airdropAmount = 0;
    const airdropEntry = typedAirdropData.find(item => item.Account === walletAddress);
    if (airdropEntry) {
      airdropAmount = airdropEntry.AIRDROP;
    }

    let currentPoints = 0;
    let pointsGainedThisSession = 0;
    let currentReferralCode: string | undefined = undefined;
    let currentCompletedActions: string[] = [];
    let newEarnedBadgeIds: string[] = user?.earnedBadgeIds || [];
    let userHighestAirdropTierLabel: string | undefined = user?.highestAirdropTierLabel;

    if (!user) {
      // New user: Create them
      // This block will now only be hit if user was NOT found by xUserId AND NOT found by walletAddress
      console.log(`[Activate Rewards] Creating new user for walletAddress: ${walletAddress} (xUserId provided: ${xUserId || 'N/A'})`);
      const newReferralCode = await generateUniqueReferralCode(db);
      currentPoints = POINTS_INITIAL_CONNECTION;
      pointsGainedThisSession += POINTS_INITIAL_CONNECTION;
      currentCompletedActions.push('initial_connection');

      currentPoints += CONNECT_WALLET_POINTS;
      pointsGainedThisSession += CONNECT_WALLET_POINTS;
      currentCompletedActions.push(CONNECT_WALLET_ACTION_ID);

      // Award "Pioneer" badge for new users
      if (!newEarnedBadgeIds.includes('pioneer_badge')) {
        newEarnedBadgeIds.push('pioneer_badge');
      }

      const newUserDocData: Omit<UserDocument, '_id'> = {
        walletAddress, // Solana Wallet
        xUserId: xUserId || walletAddress, // Use xUserId from session if present, otherwise default to walletAddress
        points: currentPoints,
        referralCode: newReferralCode,
        completedActions: currentCompletedActions,
        earnedBadgeIds: newEarnedBadgeIds,
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
      // Existing user (found by xUserId or walletAddress)
      console.log(`[Activate Rewards] Updating existing user. Found by xUserId: ${user.xUserId}, Wallet: ${user.walletAddress}. Incoming Solana Wallet for update: ${walletAddress}`);
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

      // Potentially award badges if criteria met and not already earned
      if (currentCompletedActions.includes('initial_connection') && !newEarnedBadgeIds.includes('pioneer_badge')) {
         // Awarding pioneer badge here too if they had initial_connection but somehow missed the badge
         newEarnedBadgeIds.push('pioneer_badge');
      }
    }

    // Award points for airdrop amount thresholds
    let determinedHighestTierLabelThisSession: string | undefined = undefined;
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
        // Determine highest achieved tier label for this session for badge logic and DB update
        if (airdropAmount >= threshold.amount && !determinedHighestTierLabelThisSession) { // Only set the first (highest) one encountered
            const label = threshold.tier_action_id.replace('airdrop_tier_', '');
            determinedHighestTierLabelThisSession = label.charAt(0).toUpperCase() + label.slice(1);
        }
      }
      // Award specific badge for Legend tier if achieved in this session or previously
      if (currentCompletedActions.includes('airdrop_tier_legend') && !newEarnedBadgeIds.includes('legend_tier_badge')) {
        newEarnedBadgeIds.push('legend_tier_badge');
      }
    }
    userHighestAirdropTierLabel = determinedHighestTierLabelThisSession || userHighestAirdropTierLabel;

    // Update squad points if user is in a squad and gained points this session
    // Ensure we use the correct identifier for the user for this check.
    // If user was found by xUserId, their walletAddress might not be the one passed in request yet.
    // The finalUserForSquadCheck should be based on the Solana walletAddress that is being activated/updated.
    const userForSquadCheck = await usersCollection.findOne({ walletAddress: walletAddress }); // Query by the Solana wallet being activated
    if (userForSquadCheck?.squadId && pointsGainedThisSession > 0) {
      await squadsCollection.updateOne(
        { squadId: userForSquadCheck.squadId },
        { 
          $inc: { totalSquadPoints: pointsGainedThisSession },
          $set: { updatedAt: new Date() }
        }
      );
      console.log(`Updated squad ${userForSquadCheck.squadId} points by ${pointsGainedThisSession}`);
    }

    // Final user update operation
    // Ensure the correct xUserId is persisted.
    // If found by session xUserId, that's the one.
    // If found by walletAddress, and session xUserId is also present, update the record's xUserId to the session one.
    const finalXUserIdToSet = xUserId || user?.xUserId || walletAddress; // Prioritize request xUserId, then existing, then walletAddress

    console.log(`[Activate Rewards] Finalizing user update. Wallet: ${walletAddress}, Effective xUserId to set: ${finalXUserIdToSet}`);

    await usersCollection.updateOne(
      { walletAddress }, // Always update (or upsert) based on the Solana walletAddress provided in the request
      { 
        $set: { 
          xUserId: finalXUserIdToSet, // Ensure xUserId is correctly set
          points: currentPoints, 
          completedActions: currentCompletedActions, 
          referralCode: currentReferralCode,
          highestAirdropTierLabel: userHighestAirdropTierLabel,
          earnedBadgeIds: newEarnedBadgeIds,
          // walletAddress is part of the query, so it's inherently set for inserts. For updates, it remains.
          updatedAt: new Date() 
        },
        $setOnInsert: { // Fields to set only if a new document is created by upsert
            createdAt: new Date(),
            walletAddress: walletAddress // Explicitly set walletAddress on insert
        }
      },
      { upsert: true }
    );

    const finalUser = await usersCollection.findOne({ walletAddress }); // Fetch by the Solana wallet for the response

    return NextResponse.json({
      message: user ? 'Rewards activated/updated.' : 'User created and rewards activated.',
      points: finalUser?.points || currentPoints,
      referralCode: finalUser?.referralCode || currentReferralCode,
      completedActions: finalUser?.completedActions || currentCompletedActions,
      airdropAmount: airdropAmount, 
      activeReferralBoosts: finalUser?.activeReferralBoosts || [],
      referralsMadeCount: finalUser?.referralsMadeCount || 0,
      xUsername: finalUser?.xUsername,
      highestAirdropTierLabel: finalUser?.highestAirdropTierLabel,
      earnedBadgeIds: finalUser?.earnedBadgeIds,
      squadId: finalUser?.squadId
    });

  } catch (error) {
    console.error("Error activating rewards:", error);
    return NextResponse.json({ error: 'Failed to activate rewards' }, { status: 500 });
  }
} 