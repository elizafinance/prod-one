import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { randomBytes } from 'crypto';
const POINTS_INITIAL_CONNECTION = 100; // For new users created here
// Placeholder for your database connection and logic
// import { connectToDatabase, User } from '@/lib/mongodb'; // Example
// In production, ensure this is robustly unique by checking against the database.
async function generateUniqueReferralCode(db, length = 8) {
    const usersCollection = db.collection('users');
    let referralCode = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10; // Prevent infinite loop in a highly unlikely scenario
    while (!isUnique && attempts < maxAttempts) {
        referralCode = randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
        const existingUser = await usersCollection.findOne({ referralCode });
        if (!existingUser) {
            isUnique = true;
        }
        attempts++;
    }
    if (!isUnique) {
        // Fallback or error if a unique code can't be generated after maxAttempts (very unlikely with sufficient length)
        // For now, append a short random string or timestamp
        console.warn(`Could not generate a unique referral code after ${maxAttempts} attempts. Appending random chars.`);
        return referralCode + randomBytes(2).toString('hex');
    }
    return referralCode;
}
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('address');
    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }
    try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');
        const actionsCollection = db.collection('actions');
        let user = await usersCollection.findOne({ walletAddress });
        if (user && user.referralCode) {
            return NextResponse.json({ referralCode: user.referralCode });
        }
        else if (user && !user.referralCode) {
            const newReferralCode = await generateUniqueReferralCode(db);
            await usersCollection.updateOne({ walletAddress }, { $set: { referralCode: newReferralCode, updatedAt: new Date() } });
            return NextResponse.json({ referralCode: newReferralCode });
        }
        else {
            const newReferralCode = await generateUniqueReferralCode(db);
            const initialPoints = POINTS_INITIAL_CONNECTION;
            const newUserDoc = {
                walletAddress,
                xUserId: walletAddress, // Assuming walletAddress can serve as xUserId if no X ID is present
                points: initialPoints,
                referralCode: newReferralCode,
                completedActions: ['initial_connection'],
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            await usersCollection.insertOne(newUserDoc);
            await actionsCollection.insertOne({
                walletAddress,
                actionType: 'initial_connection',
                pointsAwarded: initialPoints,
                timestamp: new Date(),
            });
            return NextResponse.json({ referralCode: newReferralCode });
        }
    }
    catch (error) {
        console.error("Error fetching/generating referral code:", error);
        return NextResponse.json({ error: 'Failed to get referral code' }, { status: 500 });
    }
}
