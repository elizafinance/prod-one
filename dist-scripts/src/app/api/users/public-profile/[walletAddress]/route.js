import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
function maskWalletAddress(address) {
    if (!address || address.length < 8)
        return address;
    return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
}
export async function GET(request, { params }) {
    const walletAddress = params.walletAddress;
    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address parameter is required' }, { status: 400 });
    }
    try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');
        const squadsCollection = db.collection('squads');
        const user = await usersCollection.findOne({ walletAddress });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        let squadInfo = null;
        if (user.squadId) {
            const squad = await squadsCollection.findOne({ squadId: user.squadId });
            if (squad) {
                squadInfo = { squadId: squad.squadId, name: squad.name };
            }
        }
        // Get referrer information if available
        let referredBy = undefined;
        if (user.referredBy) {
            const referrer = await usersCollection.findOne({ walletAddress: user.referredBy });
            if (referrer) {
                referredBy = {
                    walletAddress: maskWalletAddress(referrer.walletAddress || user.referredBy),
                    xUsername: referrer.xUsername,
                    xProfileImageUrl: referrer.xProfileImageUrl
                };
            }
        }
        const publicData = {
            maskedWalletAddress: maskWalletAddress(user.walletAddress || walletAddress),
            xUsername: user.xUsername,
            xProfileImageUrl: user.xProfileImageUrl,
            points: user.points || 0,
            highestAirdropTierLabel: user.highestAirdropTierLabel,
            referralsMadeCount: user.referralsMadeCount || 0,
            squadInfo: squadInfo,
            earnedBadgeIds: user.earnedBadgeIds || [],
            referredBy: referredBy
        };
        return NextResponse.json(publicData);
    }
    catch (error) {
        console.error("Error fetching public user profile:", error);
        return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }
}
