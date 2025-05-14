import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
const LEADERBOARD_LIMIT = 20; // Show top 20 users, for example
export async function GET(request) {
    try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');
        // Update the projection to include earnedBadgeIds
        const allUsersWithPoints = await usersCollection.find({ points: { $gt: 0 } }, {
            projection: {
                walletAddress: 1,
                points: 1,
                highestAirdropTierLabel: 1,
                xUsername: 1,
                xProfileImageUrl: 1,
                earnedBadgeIds: 1,
                _id: 0
            }
        }).sort({ points: -1 }).toArray();
        // Simple masking for wallet addresses for display
        const maskedLeaderboard = allUsersWithPoints.map(user => {
            const originalWalletAddress = user.walletAddress;
            const maskedAddress = originalWalletAddress
                ? `${originalWalletAddress.substring(0, 6)}...${originalWalletAddress.substring(originalWalletAddress.length - 4)}`
                : "[No Wallet Address]";
            return {
                ...user, // Includes points and highestAirdropTierLabel
                walletAddress: maskedAddress
            };
        });
        return NextResponse.json(maskedLeaderboard);
    }
    catch (error) {
        console.error("Error fetching leaderboard data:", error);
        return NextResponse.json({ error: 'Failed to fetch leaderboard data' }, { status: 500 });
    }
}
