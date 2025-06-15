import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument, ReferralBoost } from '@/lib/mongodb';
import { withAuth } from '@/middleware/authGuard';
import { withRateLimit } from '@/middleware/rateLimiter';
import { getPointsService, AwardPointsOptions } from '@/services/points.service';
import { AIR } from '@/config/points.config'; // Using AIR for specific point values
import { rabbitmqService } from '@/services/rabbitmq.service'; // For referral boost event
import { rabbitmqConfig } from '@/config/rabbitmq.config';
import { v4 as uuidv4 } from 'uuid'; // For generating boostId

// const PROFILE_SHARE_POINTS = 50; // Now using AIR.PROFILE_SHARE_ON_X
const PROFILE_SHARE_ACTION_TYPE = 'shared_milestone_profile_on_x';
// const REFERRAL_BOOST_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days - This was from the local interface logic

// Constants for the Referral Frenzy Boost (example, adjust as needed)
const REFERRAL_FRENZY_BOOST_DESCRIPTION = 'Referral Frenzy! +50% bonus for your next 3 referrals from Profile Share.';
const REFERRAL_FRENZY_BOOST_USES = 3;
const REFERRAL_FRENZY_BOOST_VALUE = 0.5; // 50% bonus
const REFERRAL_FRENZY_BOOST_TYPE = 'percentage_bonus_referrer';

const baseHandler = withAuth(async (request: Request, session) => {
  try {
    const walletAddress = session.user.walletAddress;
    const xUserId = session.user.xId;

    if (!walletAddress) {
      return NextResponse.json({ error: 'User walletAddress is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase(); // For direct user check/update before/after PointsService
    const usersCollection = db.collection<UserDocument>('users');
    const user = await usersCollection.findOne({ walletAddress });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if this specific profile share action was already completed
    if (user.completedActions?.includes(PROFILE_SHARE_ACTION_TYPE)) {
      return NextResponse.json({
        message: 'Profile share action already recorded. No new points or boost awarded.',
        currentPoints: user.points,
        referralBoostActive: user.activeReferralBoosts?.some((boost: ReferralBoost) => (boost.remainingUses ?? 0) > 0) ?? false // Check remainingUses for active
      });
    }

    const pointsToAward = AIR.PROFILE_SHARE_ON_X;
    const pointsService = await getPointsService();
    const awardOptions: AwardPointsOptions = {
      reason: `action:${PROFILE_SHARE_ACTION_TYPE}`,
      metadata: { xUserId: xUserId }, 
      actionType: PROFILE_SHARE_ACTION_TYPE,
    };

    // Award points using PointsService
    // The service will also add PROFILE_SHARE_ACTION_TYPE to completedActions
    const updatedUserAfterPoints = await pointsService.addPoints(walletAddress, pointsToAward, awardOptions);

    if (!updatedUserAfterPoints) {
        return NextResponse.json({ error: 'Failed to award points for profile share' }, { status: 500 });
    }

    // Activate referral boost based on the existing ReferralBoost structure from mongodb.ts
    const now = new Date();
    const newBoost: ReferralBoost = {
      boostId: uuidv4(),
      boostType: REFERRAL_FRENZY_BOOST_TYPE,
      value: REFERRAL_FRENZY_BOOST_VALUE,
      remainingUses: REFERRAL_FRENZY_BOOST_USES,
      description: REFERRAL_FRENZY_BOOST_DESCRIPTION,
      activatedAt: now,
      // Give the boost a generous expiry (e.g., 1 year); adjust as needed
      expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    };

    // Filter existing boosts - the current logic in mongodb.ts doesn't have an expiry, uses remainingUses
    const activeReferralBoosts = user.activeReferralBoosts?.filter((b: ReferralBoost) => (b.remainingUses ?? 0) > 0) || [];
    activeReferralBoosts.push(newBoost);

    await usersCollection.updateOne(
      { walletAddress },
      { 
        $set: { activeReferralBoosts: activeReferralBoosts, updatedAt: new Date() },
      }
    );
    
    // Publish event for referral boost activation
    try {
        await rabbitmqService.publishToExchange(
            rabbitmqConfig.eventsExchange,
            // TODO: Consider a more specific routing key like 'user.referral_boost.activated'
            rabbitmqConfig.routingKeys.userReferredSuccess, 
            {
                walletAddress,
                boostDetails: newBoost,
                reason: "profile_share_boost_activated",
                timestamp: new Date().toISOString(),
            }
        );
    } catch (publishError) {
        console.error(`[Profile Share] Failed to publish referral boost event for ${walletAddress}:`, publishError);
    }

    return NextResponse.json({
      message: `Profile shared successfully! +${pointsToAward} ${AIR.LABEL} and referral boost activated!`,
      newPointsTotal: updatedUserAfterPoints.points,
      referralBoost: newBoost,
    });

  } catch (error) {
    console.error('Error logging profile share:', error);
    return NextResponse.json({ error: 'Failed to log profile share action' }, { status: 500 });
  }
});

export const POST = withRateLimit(baseHandler); 