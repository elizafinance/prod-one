import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, ActionDocument, ReferralBoost } from '@/lib/mongodb';
import { withAuth } from '@/middleware/authGuard';
import { withRateLimit } from '@/middleware/rateLimiter';
import { v4 as uuidv4 } from 'uuid';

interface LogShareRequestBody {
  walletAddress: string;
}

const PROFILE_SHARE_ACTION_ID = 'shared_milestone_profile_on_x';
const PROFILE_SHARE_POINTS = 10; // Optional: Award points for sharing profile

const REFERRAL_FRENZY_BOOST_DESCRIPTION = 'Referral Frenzy! +50% bonus for your next 3 referrals.';
const REFERRAL_FRENZY_BOOST_USES = 3;
const REFERRAL_FRENZY_BOOST_VALUE = 0.5;

const handler = withAuth(async (request: Request, session) => {
  const userWalletAddress = session.user.walletAddress as string;

  try {
    const body: LogShareRequestBody = await request.json();
    // We use the session's walletAddress for security, but we can check if body.walletAddress matches if needed.
    if (body.walletAddress !== userWalletAddress) {
        console.warn(`[Log Share] Body walletAddress (${body.walletAddress}) does not match session walletAddress (${userWalletAddress}). Using session walletAddress.`);
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const actionsCollection = db.collection<ActionDocument>('actions');

    const user = await usersCollection.findOne({ walletAddress: userWalletAddress });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const alreadyDidThisSpecificShare = (user.completedActions || []).includes(PROFILE_SHARE_ACTION_ID);
    let awardedPointsForThisShare = 0;

    if (!alreadyDidThisSpecificShare && PROFILE_SHARE_POINTS > 0) {
      // atomic update
      await usersCollection.updateOne(
        { walletAddress: userWalletAddress, completedActions: { $ne: PROFILE_SHARE_ACTION_ID } },
        {
          $inc: { points: PROFILE_SHARE_POINTS },
          $addToSet: { completedActions: PROFILE_SHARE_ACTION_ID },
          $set: { updatedAt: new Date() },
        }
      );

      awardedPointsForThisShare = PROFILE_SHARE_POINTS;

      await actionsCollection.insertOne({
        walletAddress: userWalletAddress,
        actionType: PROFILE_SHARE_ACTION_ID,
        pointsAwarded: PROFILE_SHARE_POINTS,
        timestamp: new Date(),
        notes: 'User shared their milestone profile.'
      });
    }

    let newActiveBoosts = user.activeReferralBoosts || [];
    const hasFrenzyBoostAlready = newActiveBoosts.some(boost => boost.description === REFERRAL_FRENZY_BOOST_DESCRIPTION);
    let boostWasActivatedThisTime = false;

    // Grant boost if they completed the action *now* and don't already have this specific boost active.
    if (!alreadyDidThisSpecificShare && !hasFrenzyBoostAlready) { 
      const newBoost: ReferralBoost = {
        boostId: uuidv4(),
        type: 'percentage_bonus_referrer',
        value: REFERRAL_FRENZY_BOOST_VALUE,
        remainingUses: REFERRAL_FRENZY_BOOST_USES,
        description: REFERRAL_FRENZY_BOOST_DESCRIPTION,
      };
      newActiveBoosts.push(newBoost);
      boostWasActivatedThisTime = true;
    }

    await usersCollection.updateOne(
      { walletAddress: userWalletAddress },
      {
        $set: {
          activeReferralBoosts: newActiveBoosts,
          updatedAt: new Date(),
        },
      }
    );

    return NextResponse.json({ 
      message: 'Profile share action processed.',
      awardedPoints: awardedPointsForThisShare,
      boostActivated: boostWasActivatedThisTime 
    });

  } catch (error) {
    console.error("Error logging profile share:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body for profile share' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to log profile share' }, { status: 500 });
  }
});

export const POST = withRateLimit(handler); 