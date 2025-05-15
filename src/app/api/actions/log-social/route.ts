import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, ActionDocument, SquadDocument } from '@/lib/mongodb';
import { randomBytes } from 'crypto'; // For generating referral code if user is new
import { Db } from 'mongodb'; // Import Db type
import { rabbitmqService } from '@/services/rabbitmq.service';
import { rabbitmqConfig } from '@/config/rabbitmq.config';

// Placeholder for your database connection and logic
// import { connectToDatabase, User, Action } from '@/lib/mongodb'; // Example

interface RequestBody {
  walletAddress: string;
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

// Copied and adapted generateUniqueReferralCode function
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
    console.warn(`Could not generate a unique referral code in log-social after ${maxAttempts} attempts. Appending random chars.`);
    return referralCode + randomBytes(2).toString('hex'); 
  }
  return referralCode;
}

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { walletAddress, actionType } = body;

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

    let user = await usersCollection.findOne({ walletAddress });

    if (!user) {
      return NextResponse.json({ error: 'User not found. Please ensure account is activated.' }, { status: 404 });
    }

    const completedActions = user.completedActions || [];

    // Check if this is a one-time action and if it's already completed
    if (ONE_TIME_ACTIONS.includes(actionType) && completedActions.includes(actionType)) {
      return NextResponse.json({ message: `Action '${actionType}' already recorded. No new points awarded.`, currentPoints: user.points });
    }

    const pointsAwarded = POINTS_FOR_ACTION[actionType];
    const updatedPoints = (user.points || 0) + pointsAwarded;
    const updatedCompletedActions = [...completedActions];
    if (!completedActions.includes(actionType)) {
      updatedCompletedActions.push(actionType);
    }

    await usersCollection.updateOne(
      { walletAddress },
      { $set: { points: updatedPoints, completedActions: updatedCompletedActions, updatedAt: new Date() } }
    );

    // Update squad points if user is in a squad
    if (user.squadId && pointsAwarded > 0) {
      console.log(`[Log Social Action] Updating squad points for squad ${user.squadId} by ${pointsAwarded}`);
      const squadUpdateResult = await squadsCollection.updateOne(
        { squadId: user.squadId },
        { 
          $inc: { totalSquadPoints: pointsAwarded },
          $set: { updatedAt: new Date() }
        }
      );
      console.log(`[Log Social Action] Squad points update result: matched ${squadUpdateResult.matchedCount}, modified ${squadUpdateResult.modifiedCount}`);
      if (squadUpdateResult.modifiedCount > 0) {
        try {
          await rabbitmqService.publishToExchange(
            rabbitmqConfig.eventsExchange,
            rabbitmqConfig.routingKeys.squadPointsUpdated,
            {
              squadId: user.squadId,
              pointsChange: pointsAwarded,
              reason: `social_action:${actionType}`,
              timestamp: new Date().toISOString(),
              responsibleUserId: user.walletAddress
            }
          );
          console.log(`[Log Social Action] Published squad.points.updated for squad ${user.squadId}`);
        } catch (publishError) {
          console.error(`[Log Social Action] Failed to publish squad.points.updated for squad ${user.squadId}:`, publishError);
        }
      }
    }

    await actionsCollection.insertOne({
      walletAddress,
      actionType,
      pointsAwarded,
      timestamp: new Date(),
    });

    return NextResponse.json({ 
      message: `Action '${actionType}' logged successfully.`, 
      newPointsTotal: updatedPoints 
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
    console.error(`Error logging ${actionTypeForLog} for wallet: ${ (error as any)?.request?.json()?.walletAddress || 'unknown'}:`, error);
    return NextResponse.json({ error: 'Failed to log action' }, { status: 500 });
  }
} 