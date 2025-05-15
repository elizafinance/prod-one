import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, ActionDocument, ReferralBoost, SquadDocument, SquadInvitationDocument } from '@/lib/mongodb';
import airdropDataList from '@/data/airdropData.json'; // For checking airdrop amount
import { randomBytes } from 'crypto';
import { Db, ObjectId } from 'mongodb';
import { withAuth } from '@/middleware/authGuard';
import { withRateLimit } from '@/middleware/rateLimiter';
import { rabbitmqService } from '@/services/rabbitmq.service';
import { rabbitmqConfig } from '@/config/rabbitmq.config';

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
  squadInviteIdFromUrl?: string | null;
}

const baseHandler = withAuth(async (request: Request, session) => {
  try {
    const body: ActivateRequestBody = await request.json();
    const { walletAddress: newSolanaWalletAddress, xUserId, userDbId, referrerCodeFromQuery, squadInviteIdFromUrl } = body;

    if (!newSolanaWalletAddress) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }
    if (!xUserId) {
      // This endpoint is intended to be called after an X login, 
      // so xUserId (from session) is expected to link the wallet.
      console.error("[Activate Rewards] xUserId not provided in request. This is required to link wallet to an X authenticated user.");
      return NextResponse.json({ error: 'User X ID not provided; cannot link wallet.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const actionsCollection = db.collection<ActionDocument>('actions');
    const squadsCollection = db.collection<SquadDocument>('squads');
    const squadInvitesCollection = db.collection<SquadInvitationDocument>('squadInvitations');

    console.log(`[Activate Rewards] Processing activation for xUserId: ${xUserId}, Solana Wallet: ${newSolanaWalletAddress}`);

    // Step 1: Find the user by their X User ID (from session)
    let userToUpdate = await usersCollection.findOne({ xUserId });

    if (!userToUpdate) {
      console.error(`[Activate Rewards] CRITICAL: User with xUserId ${xUserId} (from session) not found in DB. The user should have been created during X signIn. Prompting re-login.`);
      return NextResponse.json({ error: 'Your user session seems invalid or the initial user record is missing. Please sign out and sign back in with X.' }, { status: 404 });
    }

    console.log(`[Activate Rewards] Found user by xUserId: ${xUserId}. Current DB walletAddress: ${userToUpdate.walletAddress}. New Solana wallet: ${newSolanaWalletAddress}`);

    // Step 2: Check if the new Solana wallet is already linked to a *different* X account
    const isFirstWalletLinkForUser = userToUpdate && userToUpdate.walletAddress !== newSolanaWalletAddress;
    if (isFirstWalletLinkForUser) {
        const conflictingUser = await usersCollection.findOne({ 
            walletAddress: newSolanaWalletAddress, 
            xUserId: { $ne: xUserId } // Look for this wallet linked to a *different* xUserId
        });

        if (conflictingUser) {
            console.warn(`[Activate Rewards] Wallet Conflict: The Solana wallet ${newSolanaWalletAddress} is already linked to a different xUserId ${conflictingUser.xUserId}. Current session xUserId is ${xUserId}.`);
            return NextResponse.json({ 
                error: `This Solana wallet is already associated with a different X account (@${conflictingUser.xUsername || conflictingUser.xUserId}). Please use a different wallet or log in with the X account originally linked to this wallet.` 
            }, { status: 409 }); // 409 Conflict
        }
        console.log(`[Activate Rewards] No conflict found for Solana wallet ${newSolanaWalletAddress}. Proceeding to link it to xUserId ${xUserId}.`);
    }

    // Step 3: Prepare updates for the user (points, completed actions, etc.)
    // Initialize from the found user (userToUpdate)
    let currentPoints = userToUpdate.points || 0;
    let pointsGainedThisSession = 0;
    let currentCompletedActions = userToUpdate.completedActions || [];
    let newEarnedBadgeIds: string[] = userToUpdate.earnedBadgeIds || [];
    let userHighestAirdropTierLabel: string | undefined = userToUpdate.highestAirdropTierLabel;
    let currentReferralCode = userToUpdate.referralCode;

    // Check airdrop amount for the newSolanaWalletAddress
    let airdropAmount = 0;
    const airdropEntry = typedAirdropData.find(item => item.Account === newSolanaWalletAddress);
    if (airdropEntry) {
      airdropAmount = airdropEntry.AIRDROP;
    }
    
    // Award points for initial X connection if not already done (should have been done in signIn, but as a safeguard)
    if (!currentCompletedActions.includes('initial_connection')) {
        console.log(`[Activate Rewards] User ${xUserId} (wallet: ${newSolanaWalletAddress}) was missing 'initial_connection'. Adding points.`);
        currentPoints += POINTS_INITIAL_CONNECTION;
        pointsGainedThisSession += POINTS_INITIAL_CONNECTION;
        currentCompletedActions.push('initial_connection');
        await actionsCollection.insertOne({
            walletAddress: newSolanaWalletAddress, // Log action with the Solana wallet
            actionType: 'initial_connection',
            pointsAwarded: POINTS_INITIAL_CONNECTION,
            timestamp: new Date(),
            notes: 'Initial X connection points (added during wallet activation safeguard)'
        });
    }
    
    // Award points for first time wallet connection
    if (!currentCompletedActions.includes(CONNECT_WALLET_ACTION_ID)) {
        console.log(`[Activate Rewards] User ${xUserId} (wallet: ${newSolanaWalletAddress}) first time wallet connect. Adding points.`);
        currentPoints += CONNECT_WALLET_POINTS;
        pointsGainedThisSession += CONNECT_WALLET_POINTS;
        currentCompletedActions.push(CONNECT_WALLET_ACTION_ID);
        await actionsCollection.insertOne({
            walletAddress: newSolanaWalletAddress,
            actionType: CONNECT_WALLET_ACTION_ID,
            pointsAwarded: CONNECT_WALLET_POINTS,
            timestamp: new Date(),
            notes: 'First wallet connection bonus'
        });
    }

    if (!currentReferralCode) {
        currentReferralCode = await generateUniqueReferralCode(db);
        console.log(`[Activate Rewards] Generated new referral code ${currentReferralCode} for user ${xUserId}`);
    }
    
    // Handle referral if referrerCodeFromQuery is present and user hasn't been referred yet
    if (referrerCodeFromQuery && !userToUpdate.referredBy && userToUpdate.walletAddress !== newSolanaWalletAddress /* to avoid self-referral if wallet was xid initially */) {
        console.log(`[Activate Rewards] Referral flow initiated. Code from query: ${referrerCodeFromQuery}, user referredBy: ${userToUpdate.referredBy || 'none'}`);
        
        const referrer = await usersCollection.findOne({ referralCode: referrerCodeFromQuery });
        if (referrer) {
            console.log(`[Activate Rewards] Referrer found with code ${referrerCodeFromQuery}. Referrer wallet: ${referrer.walletAddress || 'none'}, referrer xUserId: ${referrer.xUserId || referrer.walletAddress} (${referrerCodeFromQuery})`);
            
            if (referrer.walletAddress && referrer.walletAddress !== newSolanaWalletAddress) {
                console.log(`[Activate Rewards] Processing referral for ${xUserId} by referrer ${referrer.xUserId || referrer.walletAddress} (code: ${referrerCodeFromQuery})`);
                userToUpdate.referredBy = referrer.walletAddress; // Mark current user as referred
                
                // Award points and increment referral count for referrer
                let referrerUpdate: any = { 
                    $inc: { 
                        points: POINTS_REFERRAL_BONUS_FOR_REFERRER,
                        referralsMadeCount: 1 // Add this increment
                    },
                    $set: { updatedAt: new Date() } 
                };

                console.log(`[Activate Rewards] Will update referrer with: ${JSON.stringify(referrerUpdate)}`);

                // Handle potential referral boosts for the referrer
                let updatedReferrerBoosts = referrer.activeReferralBoosts || [];
                let pointsToAwardReferrer = POINTS_REFERRAL_BONUS_FOR_REFERRER;
                let bonusFromBoost = 0;
                let appliedBoostDescription: string | undefined = undefined;

                if (updatedReferrerBoosts.length > 0) {
                    console.log(`[Activate Rewards] Referrer has ${updatedReferrerBoosts.length} active boosts, checking if any apply`);
                    const activeBoostIndex = updatedReferrerBoosts.findIndex(
                        boost => boost.type === 'percentage_bonus_referrer' && boost.remainingUses > 0
                    );
                    if (activeBoostIndex !== -1) {
                        const boost = updatedReferrerBoosts[activeBoostIndex];
                        console.log(`[Activate Rewards] Found active boost: ${JSON.stringify(boost)}`);
                        bonusFromBoost = Math.floor(POINTS_REFERRAL_BONUS_FOR_REFERRER * boost.value);
                        pointsToAwardReferrer += bonusFromBoost;
                        appliedBoostDescription = boost.description;

                        updatedReferrerBoosts[activeBoostIndex].remainingUses -= 1;
                        if (updatedReferrerBoosts[activeBoostIndex].remainingUses <= 0) {
                            updatedReferrerBoosts.splice(activeBoostIndex, 1);
                        }
                        referrerUpdate.$set.activeReferralBoosts = updatedReferrerBoosts;
                        referrerUpdate.$inc.points = pointsToAwardReferrer; // Update points with boost
                    }
                }

                console.log(`[Activate Rewards] Updating referrer ${referrer.walletAddress} in database...`);
                const updateResult = await usersCollection.updateOne(
                    { walletAddress: referrer.walletAddress },
                    referrerUpdate
                );
                
                console.log(`[Activate Rewards] Referrer update result: matchedCount=${updateResult.matchedCount}, modifiedCount=${updateResult.modifiedCount}`);

                await actionsCollection.insertOne({
                    walletAddress: referrer.walletAddress,
                    actionType: 'referral_bonus',
                    pointsAwarded: POINTS_REFERRAL_BONUS_FOR_REFERRER, // Log standard points
                    timestamp: new Date(),
                    notes: `Referred user now identified by Solana wallet ${newSolanaWalletAddress} (originally X_User ${xUserId})`
                });

                if (bonusFromBoost > 0) {
                    await actionsCollection.insertOne({
                        walletAddress: referrer.walletAddress,
                        actionType: 'referral_powerup_bonus',
                        pointsAwarded: bonusFromBoost,
                        timestamp: new Date(),
                        notes: `Bonus from power-up: ${appliedBoostDescription || 'Referral Boost'} for referring ${newSolanaWalletAddress} (X_User ${xUserId})`
                    });
                }

                // If referrer is in a squad, update their squad points
                if (referrer.squadId) {
                    console.log(`[Activate Rewards] Updating squad ${referrer.squadId} points for referrer ${referrer.walletAddress}`);
                    const squadUpdateResult = await squadsCollection.updateOne(
                        { squadId: referrer.squadId },
                        { $inc: { totalSquadPoints: pointsToAwardReferrer }, $set: { updatedAt: new Date() } } // Use pointsToAwardReferrer which includes boost
                    );
                    console.log(`[Activate Rewards] Squad update result: matchedCount=${squadUpdateResult.matchedCount}, modifiedCount=${squadUpdateResult.modifiedCount}`);
                    if (squadUpdateResult.modifiedCount > 0 && pointsToAwardReferrer !== 0) {
                        try {
                            await rabbitmqService.publishToExchange(
                                rabbitmqConfig.eventsExchange,
                                rabbitmqConfig.routingKeys.squadPointsUpdated,
                                {
                                    squadId: referrer.squadId,
                                    pointsChange: pointsToAwardReferrer, // This is the DELTA
                                    reason: 'referrer_bonus_activation',
                                    timestamp: new Date().toISOString(),
                                    responsibleUserId: referrer.walletAddress // The referrer who earned points for the squad
                                }
                            );
                            console.log(`[Activate Rewards] Published squad.points.updated for referrer's squad ${referrer.squadId}`);
                        } catch (publishError) {
                            console.error(`[Activate Rewards] Failed to publish squad.points.updated for referrer's squad ${referrer.squadId}:`, publishError);
                        }
                    }
                }

                // Publish user.referred.success event
                try {
                  const eventPayload = {
                    userId: newSolanaWalletAddress, // The user who was referred and activated wallet
                    referredByUserId: referrer.walletAddress, // The user who made the referral
                    timestamp: new Date().toISOString(),
                    // questRelevantValue: 1 // Each successful referral counts as 1
                  };
                  await rabbitmqService.publishToExchange(
                    rabbitmqConfig.eventsExchange,
                    rabbitmqConfig.routingKeys.userReferredSuccess,
                    eventPayload
                  );
                  console.log('[Activate Rewards] Successfully published user.referred.success event:', eventPayload);
                } catch (publishError) {
                  console.error('[Activate Rewards] Failed to publish user.referred.success event:', publishError);
                  // Log and continue, core activation & referral logic succeeded.
                }
            } else {
                console.log(`[Activate Rewards] Referrer validation failed: referrer wallet address is ${referrer.walletAddress || 'missing'}, new user wallet is ${newSolanaWalletAddress}`);
            }
        } else {
            console.log(`[Activate Rewards] Referrer with code ${referrerCodeFromQuery} not found in database`);
        }
    } else if (referrerCodeFromQuery) {
        console.log(`[Activate Rewards] Referral not processed. Conditions: referrerCodeFromQuery=${!!referrerCodeFromQuery}, !userToUpdate.referredBy=${!userToUpdate.referredBy}, userToUpdate.walletAddress!==newSolanaWalletAddress=${userToUpdate.walletAddress !== newSolanaWalletAddress}`);
        if (userToUpdate.referredBy) {
            console.log(`[Activate Rewards] User already referred by: ${userToUpdate.referredBy}`);
        }
    }

    // Award "Pioneer" badge if they have initial_connection (should be true for all users going through X login)
    if (currentCompletedActions.includes('initial_connection') && !newEarnedBadgeIds.includes('pioneer_badge')) {
        newEarnedBadgeIds.push('pioneer_badge');
    }

    // Award points for airdrop amount thresholds (based on the newSolanaWalletAddress)
    let determinedHighestTierLabelThisSession: string | undefined = undefined;
    if (airdropAmount > 0) {
      for (const threshold of AIRDROP_THRESHOLDS) {
        if (airdropAmount >= threshold.amount && !currentCompletedActions.includes(threshold.tier_action_id)) {
          currentPoints += threshold.points;
          pointsGainedThisSession += threshold.points;
          currentCompletedActions.push(threshold.tier_action_id);
          await actionsCollection.insertOne({
            walletAddress: newSolanaWalletAddress, // Log with Solana wallet
            actionType: threshold.tier_action_id,
            pointsAwarded: threshold.points,
            timestamp: new Date(),
          });
        }
        if (airdropAmount >= threshold.amount && !determinedHighestTierLabelThisSession) {
            const label = threshold.tier_action_id.replace('airdrop_tier_', '');
            determinedHighestTierLabelThisSession = label.charAt(0).toUpperCase() + label.slice(1);
        }
      }
      if (currentCompletedActions.includes('airdrop_tier_legend') && !newEarnedBadgeIds.includes('legend_tier_badge')) {
        newEarnedBadgeIds.push('legend_tier_badge');
      }
    }
    userHighestAirdropTierLabel = determinedHighestTierLabelThisSession || userHighestAirdropTierLabel;

    // Step 4: Update the user document found by xUserId
    const updateData: any = {
        walletAddress: newSolanaWalletAddress, // THIS IS THE KEY UPDATE for linking
        points: currentPoints,
        completedActions: currentCompletedActions,
        referralCode: currentReferralCode, // Ensure it's set
        xUsername: userToUpdate.xUsername, // Preserve from original X login
        xProfileImageUrl: userToUpdate.xProfileImageUrl, // Preserve
        highestAirdropTierLabel: userHighestAirdropTierLabel,
        earnedBadgeIds: newEarnedBadgeIds,
        updatedAt: new Date()
    };
    if (userToUpdate.referredBy) { // if referredBy was set above, include it
        updateData.referredBy = userToUpdate.referredBy;
    }

    // ---> Variable to track if a new user account was essentially created/activated
    // We consider it "new" if the wallet is being linked for the first time.
    const isNewUserActivation = isFirstWalletLinkForUser;

    console.log(`[Activate Rewards] Finalizing update for user xUserId: ${xUserId}. New walletAddress: ${newSolanaWalletAddress}. Points: ${currentPoints}`);
    const userUpdateResult = await usersCollection.updateOne(
      { xUserId: xUserId }, // Find by xUserId
      { $set: updateData }
    );

    // --- Synchronize any squad invitations that were created before the wallet was linked ---
    // Some invitations may have been written with invitedUserWalletAddress equal to the user's X ID
    // (acting as a placeholder). After the user links a real Solana address, update those records so
    // future look-ups (which use walletAddress) will succeed.
    const inviteSyncRes = await squadInvitesCollection.updateMany(
      { invitedUserWalletAddress: xUserId, status: 'pending' },
      { $set: { invitedUserWalletAddress: newSolanaWalletAddress, updatedAt: new Date() } }
    );
    if (inviteSyncRes.modifiedCount > 0) {
      console.log(`[Activate Rewards] Synchronized ${inviteSyncRes.modifiedCount} squad invitations from xUserId placeholder to wallet address.`);
    }

    // ---> START: Create squad invitation if conditions met
    let squadInviteCreated = false;
    if (squadInviteIdFromUrl && !userToUpdate.squadId) {
      console.log(`[Activate Rewards] Processing squad invite. Squad ID: ${squadInviteIdFromUrl}, User Wallet: ${newSolanaWalletAddress}`);
      
      // 1. Find the target squad
      const targetSquad = await squadsCollection.findOne({ squadId: squadInviteIdFromUrl });
      
      if (targetSquad) {
          // 2. Check if squad is full
          const maxMembers = parseInt(process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || '10', 10);
          if (targetSquad.memberWalletAddresses.length < maxMembers) {
              // 3. Check if user is already in THIS squad or ANY squad
              if (targetSquad.memberWalletAddresses.includes(newSolanaWalletAddress)) {
                 console.log(`[Activate Rewards] User ${newSolanaWalletAddress} is already a member of target squad ${squadInviteIdFromUrl}. No invite needed.`);
              } else if (userToUpdate.squadId) { // Check if user is already in *any* squad (based on pre-update state)
                 console.log(`[Activate Rewards] User ${newSolanaWalletAddress} is already in a different squad (${userToUpdate.squadId}). Cannot auto-invite.`);
              } else {
                  // 4. Check for existing *pending* invites for this user to this squad
                  const existingPendingInvite = await squadInvitesCollection.findOne({
                      invitedUserWalletAddress: newSolanaWalletAddress,
                      squadId: targetSquad.squadId,
                      status: 'pending'
                  });

                  if (!existingPendingInvite) {
                      // 5. Create the pending invitation
                      const newInvitation: Omit<SquadInvitationDocument, '_id'> = {
                          invitationId: new ObjectId().toHexString(),
                          squadId: targetSquad.squadId,
                          squadName: targetSquad.name,
                          invitedByUserWalletAddress: targetSquad.leaderWalletAddress,
                          invitedUserWalletAddress: newSolanaWalletAddress,
                          status: 'pending',
                          createdAt: new Date(),
                          updatedAt: new Date(),
                      };
                      await squadInvitesCollection.insertOne(newInvitation);
                      squadInviteCreated = true;
                      console.log(`[Activate Rewards] Successfully created pending squad invitation for ${newSolanaWalletAddress} to squad ${targetSquad.squadId}`);
                  } else {
                      console.log(`[Activate Rewards] User ${newSolanaWalletAddress} already has a pending invite to squad ${targetSquad.squadId}.`);
                  }
              }
          } else {
              console.log(`[Activate Rewards] Target squad ${squadInviteIdFromUrl} is full. Cannot create invitation.`);
          }
      } else {
          console.warn(`[Activate Rewards] Squad with ID ${squadInviteIdFromUrl} not found. Cannot create invitation.`);
      }
    }
    // ---> END: Create squad invitation logic

    // If user joined/is in a squad AND gained points this session, update squad points
    // Re-fetch userToUpdate to get potentially updated squadId if referral changed squad status (unlikely here)
    const potentiallyUpdatedUser = await usersCollection.findOne({ xUserId });
    if (potentiallyUpdatedUser?.squadId && pointsGainedThisSession > 0) {
      await squadsCollection.updateOne(
        { squadId: potentiallyUpdatedUser.squadId },
        { 
          $inc: { totalSquadPoints: pointsGainedThisSession },
          $set: { updatedAt: new Date() }
        }
      );
      console.log(`[Activate Rewards] Updated squad ${potentiallyUpdatedUser.squadId} points by ${pointsGainedThisSession} for user ${xUserId}`);
      try {
        await rabbitmqService.publishToExchange(
            rabbitmqConfig.eventsExchange,
            rabbitmqConfig.routingKeys.squadPointsUpdated,
            {
                squadId: potentiallyUpdatedUser.squadId,
                pointsChange: pointsGainedThisSession, // This is the DELTA
                reason: 'user_activation_points',
                timestamp: new Date().toISOString(),
                responsibleUserId: potentiallyUpdatedUser.walletAddress // The user whose activation points contributed
            }
        );
        console.log(`[Activate Rewards] Published squad.points.updated for user's squad ${potentiallyUpdatedUser.squadId}`);
      } catch (publishError) {
          console.error(`[Activate Rewards] Failed to publish squad.points.updated for user's squad ${potentiallyUpdatedUser.squadId}:`, publishError);
      }
    }

    // Fetch the fully updated user for the response
    const finalUser = await usersCollection.findOne({ xUserId: xUserId });

    if (!finalUser) {
        console.error(`[Activate Rewards] CRITICAL: Failed to re-fetch user ${xUserId} after update.`);
        return NextResponse.json({ error: 'Failed to finalize user activation. Please try again.' }, { status: 500 });
    }
    
    return NextResponse.json({
      message: squadInviteCreated 
                 ? 'Rewards activated! Wallet linked & squad invite sent.' 
                 : 'Rewards activated/updated successfully. Wallet linked to your X account.',
      isNewUser: isNewUserActivation, // ---> Pass back isNewUser status for modal trigger
      points: finalUser.points,
      referralCode: finalUser.referralCode,
      completedActions: finalUser.completedActions,
      airdropAmount: airdropAmount, // Based on the newSolanaWalletAddress
      activeReferralBoosts: finalUser.activeReferralBoosts || [],
      referralsMadeCount: finalUser.referralsMadeCount || 0,
      xUsername: finalUser.xUsername,
      walletAddress: finalUser.walletAddress, // Should now be the newSolanaWalletAddress
      highestAirdropTierLabel: finalUser.highestAirdropTierLabel,
      earnedBadgeIds: finalUser.earnedBadgeIds,
      squadId: finalUser.squadId
    });

  } catch (error) {
    console.error("[Activate Rewards] General Error:", error);
    return NextResponse.json({ error: 'Failed to activate rewards' }, { status: 500 });
  }
});

export const POST = withRateLimit(baseHandler); 