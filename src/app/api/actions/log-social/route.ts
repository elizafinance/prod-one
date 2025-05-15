import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, ActionDocument, SquadDocument } from '@/lib/mongodb';
import { withAuth } from '@/middleware/authGuard';
import { withRateLimit } from '@/middleware/rateLimiter';
import { randomBytes } from 'crypto'; // For generating referral code if user is new
import { Db } from 'mongodb'; // Import Db type
import { rabbitmqService } from '@/services/rabbitmq.service';
import { rabbitmqConfig } from '@/config/rabbitmq.config';

// Placeholder for your database connection and logic
// import { connectToDatabase, User, Action } from '@/lib/mongodb'; // Example

interface RequestBody {
  walletAddress?: string; // Made optional if session provides it
  xUserId?: string; // If action is tied to X user not wallet
  actionType: 'shared_on_x' | 'followed_on_x' | 'joined_telegram';
}

// Define points for each action
const POINTS_FOR_ACTION: Record<RequestBody['actionType'], number> = {
  'shared_on_x': 50,
  'followed_on_x': 30,
  'joined_telegram': 25, // Points for joining Telegram
};

// Define actions that should only award points once
const ONE_TIME_ACTIONS: RequestBody['actionType'][] = ['followed_on_x', 'joined_telegram', 'shared_on_x']; // shared_on_x can be one-time or repeatable with daily/weekly limits (more complex)

const baseHandler = withAuth(async (request: Request, session) => {
  try {
    const body: RequestBody = await request.json();
    // Prioritize walletAddress from session if available and action is wallet-based
    const walletAddress = session.user.walletAddress || body.walletAddress;
    const xUserId = session.user.xId || body.xUserId;
    const { actionType } = body;

    if (!walletAddress && !xUserId) {
      return NextResponse.json({ error: 'User identifier (walletAddress or xUserId) is required' }, { status: 400 });
    }
    if (!actionType || !POINTS_FOR_ACTION[actionType]) {
      return NextResponse.json({ error: 'Invalid or missing action type' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const actionsCollection = db.collection<ActionDocument>('actions');
    const squadsCollection = db.collection<SquadDocument>('squads');

    // Find user by walletAddress or xUserId, depending on action context
    // For simplicity, let's assume walletAddress is the primary link for points here.
    // If xUserId actions can occur without a linked wallet, user lookup needs to be more flexible.
    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address is required for this action' }, { status: 400 });
    }
    let user = await usersCollection.findOne({ walletAddress });

    if (!user) {
      return NextResponse.json({ error: 'User not found. Please ensure account is activated.' }, { status: 404 });
    }

    const completedActions = user.completedActions || [];
    let pointsAwarded = 0;
    let alreadyRecorded = false;

    if (ONE_TIME_ACTIONS.includes(actionType) && completedActions.includes(actionType)) {
      alreadyRecorded = true;
    } else {
      pointsAwarded = POINTS_FOR_ACTION[actionType];
    }

    if (alreadyRecorded) {
      return NextResponse.json({ message: `Action '${actionType}' already recorded. No new points awarded.`, currentPoints: user.points });
    }
    
    const updatedPoints = (user.points || 0) + pointsAwarded;
    const updatedCompletedActions = [...completedActions];
    if (!completedActions.includes(actionType)) {
      updatedCompletedActions.push(actionType);
    }

    // Update user document
    await usersCollection.updateOne(
      { walletAddress }, // Query by walletAddress
      { $set: { points: updatedPoints, completedActions: updatedCompletedActions, updatedAt: new Date() } }
    );

    // This is the merged squad points update logic from squad-goals
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

    // Log the action itself
    await actionsCollection.insertOne({
      walletAddress, // Use the resolved walletAddress
      actionType,
      pointsAwarded,
      timestamp: new Date(),
    });

    return NextResponse.json({ 
      message: `Action '${actionType}' logged successfully. +${pointsAwarded} points.`, 
      newPointsTotal: updatedPoints 
    });

  } catch (error) {
    let actionTypeForLog = 'unknown_action';
    try {
        const body = await request.clone().json(); 
        actionTypeForLog = body?.actionType || 'unknown_action_in_catch';
    } catch (parseError) { /* ignore */ }
    console.error(`Error logging ${actionTypeForLog}:`, error);
    return NextResponse.json({ error: 'Failed to log action' }, { status: 500 });
  }
});

export const POST = withRateLimit(baseHandler); 