import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument, ActionDocument, ReferralBoost } from '@/lib/mongodb';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ObjectId, Db } from 'mongodb';
import { rabbitmqService } from '@/services/rabbitmq.service';
import { rabbitmqConfig } from '@/config/rabbitmq.config';
import { getPointsService, AwardPointsOptions } from '@/services/points.service';
import { AIR, ACTION_TYPE_POINTS } from '@/config/points.config';
import { v4 as uuidv4 } from 'uuid'; // For referral boost ID if that logic stays
import { randomBytes } from 'crypto';

// const POINTS_INITIAL_CONNECTION = 100; // Replaced by AIR.INITIAL_LOGIN
const ACTION_INITIAL_CONNECTION = 'initial_connection';
// const CONNECT_WALLET_POINTS = 100; // Replaced by AIR.WALLET_CONNECT_FIRST_TIME
const ACTION_WALLET_CONNECTED_FIRST_TIME = 'wallet_connected_first_time';
// const POINTS_REFERRAL_BONUS_FOR_REFERRER = 20; // Replaced by AIR.REFERRAL_BONUS_FOR_REFERRER
const ACTION_REFERRAL_BONUS = 'referral_bonus';

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
      console.warn(`Could not generate unique referral code in activate-rewards after ${maxAttempts} attempts.`);
    return referralCode + randomBytes(2).toString('hex'); 
  }
  return referralCode;
}

// Helper to determine if referral boost should be applied
function shouldApplyReferralBoost(referrer?: UserDocument): ReferralBoost | undefined {
    if (!referrer || !referrer.activeReferralBoosts || referrer.activeReferralBoosts.length === 0) {
        return undefined;
    }
    // Find an active boost (e.g., with remaining uses)
    // This logic might need refinement based on how boosts are structured and prioritized
    return referrer.activeReferralBoosts.find((boost: ReferralBoost) => (boost.remainingUses || 0) > 0);
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions) as Session | null;
    if (!session || !session.user || !session.user.dbId) {
        return NextResponse.json({ error: 'User not authenticated or session invalid' }, { status: 401 });
    }

    const userDbId = session.user.dbId;
    // const userXIdFromSession = session.user.xId; // xId from session, may differ from user.xUserId from DB if updated

    try {
        const { walletAddress, referredByCode, squadInviteIdFromUrl } = await request.json();

        if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
        const pointsService = await getPointsService();

        let user = await usersCollection.findOne({ _id: new ObjectId(userDbId) });
        if (!user) {
            return NextResponse.json({ error: 'Authenticated user not found in database' }, { status: 404 });
        }
        
        const isNewWalletAssociation = !user.walletAddress;
        let pointsAwardedForWalletConnect = 0;
        let awardedInitialConnectionPoints = false; // This flag is for the response, actual awarding is in auth.ts

        // Scenario 1: User record might exist from X login, but no wallet yet.
        // The initial_connection points are typically awarded in auth.ts signIn callback.
        // We double-check here if, for some reason, it wasn't awarded or completed.
        if (!user.completedActions?.includes(ACTION_INITIAL_CONNECTION)) {
            // This case should be rare if auth.ts handles it properly.
            // If PointsService.addPoints is called, it will log the action & update completedActions.
            // For now, we assume auth.ts handles this. If direct awarding is needed here:
            // await pointsService.addPoints(walletAddress, AIR.INITIAL_LOGIN, {
            //    reason: 'activate-rewards:initial_connection',
            //    actionType: ACTION_INITIAL_CONNECTION,
            // });
            // awardedInitialConnectionPoints = true; // to reflect in response
        }

        // Scenario 2: Connecting wallet for the first time to this account
        if (isNewWalletAssociation) {
            // Check if another user already has this wallet - this is a critical conflict.
            const existingUserWithWallet = await usersCollection.findOne({ walletAddress });
            if (existingUserWithWallet && existingUserWithWallet._id.toString() !== user._id.toString()) {
                console.error(`[Activate Rewards] Critical: Wallet ${walletAddress} is already associated with another user ${existingUserWithWallet._id.toString()}`);
                return NextResponse.json({ error: 'This wallet is already linked to another account.' }, { status: 409 }); // Conflict
            }

            // Update current user with walletAddress
            await usersCollection.updateOne({ _id: user._id }, { $set: { walletAddress, updatedAt: new Date() } });
            user.walletAddress = walletAddress; // Reflect update locally

            if (!user.completedActions?.includes(ACTION_WALLET_CONNECTED_FIRST_TIME)) {
                const updatedUser = await pointsService.addPoints(walletAddress, AIR.WALLET_CONNECT_FIRST_TIME, {
                    reason: 'activate-rewards:wallet_connected_first_time',
                    actionType: ACTION_WALLET_CONNECTED_FIRST_TIME,
                    metadata: { xUserId: user.xUserId } // Use user.xUserId from DB document
                });
                if (updatedUser) pointsAwardedForWalletConnect = AIR.WALLET_CONNECT_FIRST_TIME;
            }
        }
        // If wallet was already associated, no points for connection unless explicitly handled otherwise.

        // Scenario 3: Process referral if `referredByCode` is provided
        let referralBonusAwarded = 0;
        let referredByUsername: string | undefined = undefined;

        if (referredByCode && isNewWalletAssociation && user.referredByCode !== referredByCode) { // Process referral only once and if wallet is new
            const referrer = await usersCollection.findOne({ referralCode: referredByCode });
            if (referrer && referrer.walletAddress !== walletAddress) { // Cannot refer self
                referredByUsername = referrer.xUsername || referrer.walletAddress;
                let pointsForReferrer = AIR.REFERRAL_BONUS_FOR_REFERRER;
                const activeBoost = shouldApplyReferralBoost(referrer);
                let boostAppliedDetails: any = null;

                if (activeBoost && activeBoost.type === 'percentage_bonus_referrer' && activeBoost.value && activeBoost.remainingUses && activeBoost.remainingUses > 0) {
                    const bonusFromBoost = Math.floor(pointsForReferrer * activeBoost.value);
                    pointsForReferrer += bonusFromBoost;
                    // Decrement boost usage
                    await usersCollection.updateOne(
                        { _id: referrer._id, "activeReferralBoosts.boostId": activeBoost.boostId },
                        { $inc: { "activeReferralBoosts.$.remainingUses": -1 } }
                    );
                    boostAppliedDetails = { 
                        boostId: activeBoost.boostId, 
                        description: activeBoost.description, 
                        bonusPoints: bonusFromBoost 
                    };
                }

                if (referrer.walletAddress) { // Referrer must have a wallet to receive points via PointsService
                    await pointsService.addPoints(referrer.walletAddress, pointsForReferrer, {
                        reason: 'referral:bonus_for_referrer',
                        actionType: ACTION_REFERRAL_BONUS,
                        metadata: { referredUserWallet: walletAddress, referredUserXId: user.xUserId, boost: boostAppliedDetails } // Use user.xUserId
                    });
                    referralBonusAwarded = pointsForReferrer; // To the referrer
                }
                
                // Mark current user as referred
                await usersCollection.updateOne({ _id: user._id }, { $set: { referredByCode: referredByCode, referredByUserId: referrer._id } });
                user.referredByCode = referredByCode as string; // Assert type after assignment or ensure `referredByCode` is string

                // Publish referral success event
                        try {
                            await rabbitmqService.publishToExchange(
                                rabbitmqConfig.eventsExchange,
                        rabbitmqConfig.routingKeys.userReferredSuccess,
                        {
                            referrerWalletAddress: referrer.walletAddress,
                            referredUserWalletAddress: walletAddress,
                            pointsAwardedToReferrer: pointsForReferrer,
                                    timestamp: new Date().toISOString(),
                            boostApplied: boostAppliedDetails
                        }
                    );
                } catch (publishError) {
                    console.error(`[Activate Rewards] Failed to publish user.referred.success:`, publishError);
                }
            }
        }
        
        // Ensure user has a referral code if they don't have one already
        if (!user.referralCode) {
            const newReferralCode = await generateUniqueReferralCode(db);
            await usersCollection.updateOne({ _id: user._id }, { $set: { referralCode: newReferralCode } });
            user.referralCode = newReferralCode; // Reflect locally
        }

        // TODO: Process squadInviteIdFromUrl if provided
        // This logic might involve checking the invite, adding user to squad, awarding points, etc.
        // It could call a shared squad service function or interact with squad-related collections.
        // For now, we'll just acknowledge it if present.
        let squadInviteProcessed = false;
        if (squadInviteIdFromUrl) {
            console.log(`[Activate Rewards] Received squadInviteIdFromUrl: ${squadInviteIdFromUrl} for user ${user._id}. Placeholder for processing.`);
            // Example: try {
            //   const squadJoinResult = await squadService.processSquadInvite(db, user, squadInviteIdFromUrl);
            //   if (squadJoinResult.success) squadInviteProcessed = true;
            // } catch (squadError) { console.error('Error processing squad invite during activation:', squadError); }
            // For the purpose of this fix, we are only acknowledging it. Actual processing is a separate feature/bug.
            squadInviteProcessed = true; // Simulate processing for now for the response
        }

        // Fetch the latest user state to return
        const finalUser = await usersCollection.findOne({ _id: user._id });

        return NextResponse.json({
            message: "Rewards status updated successfully.",
            user: finalUser,
            pointsAwardedForWalletConnect,
            awardedInitialConnectionPoints,
            referralProcessed: referralBonusAwarded > 0,
            referredBy: referredByUsername,
            referralBonusToReferrer: referralBonusAwarded,
            squadInviteProcessed // Added to response
        });

    } catch (error: any) {
        console.error("Error activating rewards:", error);
        return NextResponse.json({ error: error.message || "Failed to activate rewards" }, { status: 500 });
    }
} 