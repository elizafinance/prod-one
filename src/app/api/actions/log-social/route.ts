import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, ActionDocument, SquadDocument } from '@/lib/mongodb';
import { withAuth } from '@/middleware/authGuard';
import { withRateLimit } from '@/middleware/rateLimiter';

// Placeholder for your database connection and logic
// import { connectToDatabase, User, Action } from '@/lib/mongodb'; // Example

interface RequestBody {
  actionType: 'shared_on_x' | 'followed_on_x' | 'joined_telegram'; // Expanded action types
}

// Define points for each action
const POINTS_FOR_ACTION: Record<RequestBody['actionType'], number> = {
  'shared_on_x': 50,
  'followed_on_x': 30,
  'joined_telegram': 25, // Points for joining Telegram
};

// Define actions that should only award points once
const ONE_TIME_ACTIONS: RequestBody['actionType'][] = ['followed_on_x', 'joined_telegram', 'shared_on_x']; // shared_on_x can be one-time or repeatable with daily/weekly limits (more complex)

const handler = withAuth(async (request: Request, session) => {
  try {
    const body: RequestBody = await request.json();
    const { actionType } = body;

    const walletAddress = session.user.walletAddress as string;

    if (!walletAddress || !actionType) {
      return NextResponse.json({ error: 'Wallet address and action type are required' }, { status: 400 });
    }

    if (!POINTS_FOR_ACTION[actionType]) {
      return NextResponse.json({ error: 'Invalid action type' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const actionsCollection = db.collection<ActionDocument>('actions');
    const squadsCollection = db.collection<SquadDocument>('squads');

    const pointsAwarded = POINTS_FOR_ACTION[actionType];

    // Atomic update: only apply if action not already in completedActions (for one-time actions)
    const userUpdateFilter: any = { walletAddress };
    if (ONE_TIME_ACTIONS.includes(actionType)) {
      userUpdateFilter.completedActions = { $ne: actionType };
    }

    const updateResult = await usersCollection.updateOne(
      userUpdateFilter,
      {
        $inc: { points: pointsAwarded },
        $addToSet: { completedActions: actionType },
        $set: { updatedAt: new Date() },
      }
    );

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json({ message: `Action '${actionType}' already recorded. No new points awarded.` });
    }

    // fetch user to get squadId & new points
    const user = await usersCollection.findOne({ walletAddress });

    if (user?.squadId) {
      await squadsCollection.updateOne(
        { squadId: user.squadId },
        {
          $inc: { totalSquadPoints: pointsAwarded },
          $set: { updatedAt: new Date() },
        }
      );
      console.log(`Updated squad ${user.squadId} points by ${pointsAwarded} from social action by ${walletAddress}`);
    }

    await actionsCollection.insertOne({
      walletAddress,
      actionType,
      pointsAwarded,
      timestamp: new Date(),
    });

    return NextResponse.json({
      message: `Action '${actionType}' logged successfully.`,
      newPointsTotal: user?.points ?? undefined,
    });

  } catch (error) {
    // Attempt to get actionType from body for better logging, robustly handle if body parsing failed
    let actionTypeForLog = 'unknown_action';
    try {
        const body = await request.clone().json(); // Clone request to read body again if needed
        actionTypeForLog = body?.actionType || 'unknown_action_in_catch';
    } catch (parseError) {
        // Ignore if body can't be parsed again, use default
    }
    console.error(`Error logging ${actionTypeForLog} for wallet: ${session?.user?.walletAddress || 'unknown'}:`, error);
    return NextResponse.json({ error: 'Failed to log action' }, { status: 500 });
  }
});

export const POST = withRateLimit(handler); 