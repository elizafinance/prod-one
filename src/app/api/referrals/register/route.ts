import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, ActionDocument } from '@/lib/mongodb';
// import { randomBytes } from 'crypto'; // Not needed here if new users are created with codes elsewhere

interface RequestBody {
  newWalletAddress: string;
  referralCode: string;
}

const POINTS_REFERRAL_BONUS_FOR_REFERRER = 20; // Using the value from your instructions
// const POINTS_FOR_BEING_REFERRED = 10; // Optional: Points for the new user, if you decide to implement

export async function POST(request: Request) {
  try {
    const body: RequestBody = await request.json();
    const { newWalletAddress, referralCode } = body;

    if (!newWalletAddress || !referralCode) {
      return NextResponse.json({ error: 'New wallet address and referral code are required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const actionsCollection = db.collection<ActionDocument>('actions');

    // Find the referrer by their referral code
    const referrer = await usersCollection.findOne({ referralCode });

    if (!referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    if (referrer.walletAddress === newWalletAddress) {
      return NextResponse.json({ error: 'Cannot refer yourself' }, { status: 400 });
    }

    // Check if the new user already exists and if they have already been referred
    let newUser = await usersCollection.findOne({ walletAddress: newWalletAddress });

    // This route assumes the new user might already exist from a previous interaction (e.g., check-airdrop, get-code)
    // We only award referral bonus if the new user hasn't been marked as referredBy yet.
    if (newUser && newUser.referredBy) {
      return NextResponse.json({ message: 'User has already been referred or processed a referral' }, { status: 409 });
    }

    // Ensure referrer has a walletAddress, which should always be the case if they are a valid referrer
    if (!referrer.walletAddress) {
      console.error(`Referrer with code ${referralCode} found but has no walletAddress.`);
      return NextResponse.json({ error: 'Referrer account is incomplete.' }, { status: 500 });
    }
    
    // Award points to referrer
    await usersCollection.updateOne(
      { walletAddress: referrer.walletAddress },
      { 
        $inc: { 
          points: POINTS_REFERRAL_BONUS_FOR_REFERRER,
          referralsMadeCount: 1 // Increment referrals made count
        },
        $set: { updatedAt: new Date() }
      }
    );
    await actionsCollection.insertOne({
      walletAddress: referrer.walletAddress,
      actionType: 'referral_bonus',
      pointsAwarded: POINTS_REFERRAL_BONUS_FOR_REFERRER,
      timestamp: new Date(),
      notes: `Referred ${newWalletAddress}`
    });

    // Create or update the new user, linking them to the referrer
    if (!newUser) {
      // New user being registered via referral link *after* referrer already exists.
      // They should have gotten initial points via check-airdrop or get-code if that was their first touchpoint.
      // If this is their absolute first touchpoint, they won't get initial_connection points here unless we add that logic.
      // For simplicity, this route focuses on the referral aspect.
      await usersCollection.insertOne({
        walletAddress: newWalletAddress,
        xUserId: newWalletAddress, // Assuming newWalletAddress can serve as xUserId
        points: 0, // Or POINTS_FOR_BEING_REFERRED if you implement that
        referredBy: referrer.walletAddress,
        createdAt: new Date(),
        updatedAt: new Date(),
        completedActions: [] // Initialize if they are brand new through this path
      });
    } else { // User exists but was not referred by anyone yet
      await usersCollection.updateOne(
        { walletAddress: newWalletAddress },
        { 
          $set: { referredBy: referrer.walletAddress, updatedAt: new Date() },
          // $inc: { points: POINTS_FOR_BEING_REFERRED } // Optionally award points for being referred
        }
      );
    }

    return NextResponse.json({ 
      message: `Referral successful! Referrer (${referrer.walletAddress}) earned ${POINTS_REFERRAL_BONUS_FOR_REFERRER} points.` 
    });

  } catch (error) {
    console.error("Error processing referral:", error);
    return NextResponse.json({ error: 'Failed to process referral' }, { status: 500 });
  }
} 