import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, ActionDocument, SquadDocument } from '@/lib/mongodb'; // Kept for direct DB access if needed, though PointsService abstracts some
import { withAuth } from '@/middleware/authGuard';
import { withRateLimit } from '@/middleware/rateLimiter';
// import { randomBytes } from 'crypto'; // Not used here
// import { Db } from 'mongodb'; // Not directly used here
import { getPointsService, AwardPointsOptions } from '@/services/points.service';
import { AIR, ACTION_TYPE_POINTS } from '@/config/points.config';

// Placeholder for your database connection and logic
// import { connectToDatabase, User, Action } from '@/lib/mongodb'; // Example

interface RequestBody {
  walletAddress?: string; // Optional if session provides it
  xUserId?: string; // If action is tied to X user not wallet
  actionType: keyof typeof ACTION_TYPE_POINTS; // Use keys from our config for type safety
}

// Points for each action are now primarily managed by ACTION_TYPE_POINTS in points.config.ts
// const POINTS_FOR_ACTION: Record<RequestBody['actionType'], number> = { ... }; // Redundant

// Define actions that should only award points once
const ONE_TIME_ACTIONS: Array<keyof typeof ACTION_TYPE_POINTS> = ['followed_on_x', 'joined_telegram', 'shared_on_x']; // shared_on_x might be complex

const baseHandler = withAuth(async (request: Request, session) => {
  try {
    const body: RequestBody = await request.json();
    const walletAddress = session.user.walletAddress; // PointsService requires a walletAddress
    const xUserId = session.user.xId || body.xUserId;
    const { actionType } = body;

    if (!walletAddress) {
        // If no wallet address in session, this action cannot proceed via PointsService as designed
        // This indicates a potential flow issue if social actions are logged before wallet connection
        // and PointsService strictly requires walletAddress.
        // For now, we must have a walletAddress to use PointsService.
        return NextResponse.json({ error: 'User walletAddress is required to log this action' }, { status: 400 });
    }

    if (!actionType || !ACTION_TYPE_POINTS[actionType]) {
      return NextResponse.json({ error: 'Invalid or missing action type' }, { status: 400 });
    }

    const { db } = await connectToDatabase(); // For direct user check before PointsService
    const usersCollection = db.collection<UserDocument>('users');
    const user = await usersCollection.findOne({ walletAddress });

    if (!user) {
      return NextResponse.json({ error: 'User not found. Please ensure account is activated.' }, { status: 404 });
    }

    const pointsToAward = ACTION_TYPE_POINTS[actionType];
    let alreadyRecorded = false;

    if (ONE_TIME_ACTIONS.includes(actionType) && user.completedActions?.includes(actionType)) {
      alreadyRecorded = true;
    }

    if (alreadyRecorded) {
      return NextResponse.json({ message: `Action '${actionType}' already recorded. No new points awarded.`, currentPoints: user.points });
    }
    
    if (pointsToAward === 0 && !alreadyRecorded) {
        // If pointsToAward is 0, we might still want to record the action as completed, but not call PointsService
        // For now, let's assume 0 point actions are not sent here or PointsService handles it.
        // Or, we can just log it without awarding points through the service.
        // This part needs clarification based on desired behavior for 0-point actions.
    }

    const pointsService = await getPointsService();
    const awardOptions: AwardPointsOptions = {
        reason: `action:${actionType}`,
        metadata: { xUserId: xUserId }, // Log xUserId if available
        actionType: actionType, // Pass the specific actionType for completedActions logic
    };

    const updatedUser = await pointsService.addPoints(walletAddress, pointsToAward, awardOptions);

    if (!updatedUser) {
        // Handle case where PointsService returns null (e.g., user not found, though checked above)
        return NextResponse.json({ error: 'Failed to process action via PointsService' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: `Action '${actionType}' logged successfully. +${pointsToAward} points.`, 
      newPointsTotal: updatedUser.points 
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