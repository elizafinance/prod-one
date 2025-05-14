import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
export async function POST(request, { params }) {
    // Type assertion after fetching, assuming authOptions ensures this structure
    const session = await getServerSession(authOptions);
    // Perform runtime check, satisfying TypeScript 
    if (!session?.user?.walletAddress) {
        return NextResponse.json({ error: 'Authentication required (Wallet address missing from session)' }, { status: 401 });
    }
    // Now TypeScript knows session.user.walletAddress is a string here
    const currentLeaderWalletAddress = session.user.walletAddress;
    const squadId = params.squadId;
    if (!squadId) {
        return NextResponse.json({ error: 'Squad ID is required' }, { status: 400 });
    }
    try {
        const body = await request.json();
        const { newLeaderWalletAddress } = body;
        if (!newLeaderWalletAddress) {
            return NextResponse.json({ error: 'New leader wallet address is required' }, { status: 400 });
        }
        if (newLeaderWalletAddress === currentLeaderWalletAddress) {
            return NextResponse.json({ error: 'Cannot transfer leadership to yourself' }, { status: 400 });
        }
        const { db } = await connectToDatabase();
        const squadsCollection = db.collection('squads');
        const squad = await squadsCollection.findOne({ squadId: squadId });
        if (!squad) {
            return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
        }
        // Verify the current user is the leader
        if (squad.leaderWalletAddress !== currentLeaderWalletAddress) {
            return NextResponse.json({ error: 'Only the current leader can transfer leadership' }, { status: 403 });
        }
        // Verify the new leader is a member of the squad
        if (!squad.memberWalletAddresses.includes(newLeaderWalletAddress)) {
            return NextResponse.json({ error: 'The selected user is not a member of this squad' }, { status: 400 });
        }
        // Update the squad document
        const updateResult = await squadsCollection.updateOne({ squadId: squadId, leaderWalletAddress: currentLeaderWalletAddress }, // Ensure atomicity
        {
            $set: {
                leaderWalletAddress: newLeaderWalletAddress,
                updatedAt: new Date()
            }
        });
        if (updateResult.modifiedCount === 0) {
            // This could happen if the squad was modified concurrently or if the query failed
            console.error(`Failed to transfer leadership for squad ${squadId}. Leader: ${currentLeaderWalletAddress}, Target: ${newLeaderWalletAddress}`);
            return NextResponse.json({ error: 'Failed to update leadership. Please try again.' }, { status: 500 });
        }
        console.log(`Leadership transferred for squad ${squadId} from ${currentLeaderWalletAddress} to ${newLeaderWalletAddress}`);
        return NextResponse.json({ message: 'Leadership transferred successfully!' });
    }
    catch (error) {
        console.error("Error transferring squad leadership:", error);
        return NextResponse.json({ error: 'Failed to transfer leadership' }, { status: 500 });
    }
}
