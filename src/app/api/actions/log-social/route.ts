import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, ActionDocument } from '@/lib/mongodb';
import { randomBytes } from 'crypto'; // For generating referral code if user is new
import { Db } from 'mongodb'; // Import Db type

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

    let user = await usersCollection.findOne({ walletAddress });

    // If user doesn't exist, create them with initial points and referral code
    // This scenario assumes that an action here might be a user's first interaction.
    // The 'initial_connection' points should ideally be handled by a dedicated registration or first-event API (like check-airdrop).
    // For simplicity here, if a user is created via this endpoint, they don't get the 100 initial points automatically,
    // but that logic is present in the check-airdrop route.
    if (!user) {
      const newReferralCode = await generateUniqueReferralCode(db); // Use unique generator
      // User created here gets 0 initial points, points for this action will be added below.
      // The 100 initial_connection points are tied to the check-airdrop or get-code flows.
      const newUserDoc: UserDocument = {
        walletAddress,
        xUserId: walletAddress, // Assuming walletAddress can serve as xUserId if no X ID is present
        points: 0, // Start with 0, action points will be added below
        referralCode: newReferralCode,
        completedActions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const insertResult = await usersCollection.insertOne(newUserDoc);
      user = await usersCollection.findOne({ _id: insertResult.insertedId }); 
      if (!user) {
        return NextResponse.json({ error: 'Failed to create new user' }, { status: 500 });
      }
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