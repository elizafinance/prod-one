import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
export async function GET(request, { params }) {
    const squadId = params.squadId;
    if (!squadId) {
        return NextResponse.json({ error: 'Squad ID parameter is required' }, { status: 400 });
    }
    try {
        const { db } = await connectToDatabase();
        const squadsCollection = db.collection('squads');
        const usersCollection = db.collection('users');
        const squad = await squadsCollection.findOne({ squadId });
        if (!squad) {
            return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
        }
        const membersFullDetails = [];
        if (squad.memberWalletAddresses && squad.memberWalletAddresses.length > 0) {
            const memberUsers = await usersCollection.find({ walletAddress: { $in: squad.memberWalletAddresses } }, { projection: { walletAddress: 1, xUsername: 1, xProfileImageUrl: 1, points: 1, _id: 0 } }).toArray();
            // Create a map for quick lookup
            const memberUserMap = new Map();
            memberUsers.forEach(member => {
                if (member.walletAddress) {
                    memberUserMap.set(member.walletAddress, member);
                }
            });
            // Populate details in the original order of memberWalletAddresses
            for (const walletAddr of squad.memberWalletAddresses) {
                const memberDetail = memberUserMap.get(walletAddr);
                membersFullDetails.push({
                    walletAddress: walletAddr,
                    xUsername: memberDetail?.xUsername,
                    xProfileImageUrl: memberDetail?.xProfileImageUrl,
                    points: memberDetail?.points,
                });
            }
        }
        // Fetch the leader's referral code separately
        let leaderReferralCode = undefined;
        if (squad.leaderWalletAddress) {
            const leaderUser = await usersCollection.findOne({ walletAddress: squad.leaderWalletAddress }, { projection: { _id: 0, referralCode: 1 } });
            leaderReferralCode = leaderUser?.referralCode;
        }
        const enrichedSquadData = {
            ...squad,
            membersFullDetails,
        };
        // Combine squad data with member details and leader referral code
        const responsePayload = {
            squad: {
                ...enrichedSquadData,
                leaderReferralCode: leaderReferralCode, // Include the code
            }
        };
        return NextResponse.json(responsePayload);
    }
    catch (error) {
        console.error(`Error fetching details for squad ${squadId}:`, error);
        return NextResponse.json({ error: 'Failed to fetch squad details' }, { status: 500 });
    }
}
