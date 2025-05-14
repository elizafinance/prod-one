import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createNotification } from '@/lib/notificationUtils';
export async function POST(request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
        return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
    }
    const userWalletAddress = session.user.walletAddress;
    const userXUsername = session.user.xUsername || userWalletAddress;
    try {
        const { db } = await connectToDatabase();
        const squadsCollection = db.collection('squads');
        const usersCollection = db.collection('users');
        const user = await usersCollection.findOne({ walletAddress: userWalletAddress });
        if (!user || !user.squadId) {
            if (!user)
                return NextResponse.json({ error: 'Authenticated user not found in database.' }, { status: 404 });
            return NextResponse.json({ error: 'You are not currently in a squad.' }, { status: 400 });
        }
        const squadIdUserWasIn = user.squadId;
        const currentSquad = await squadsCollection.findOne({ squadId: squadIdUserWasIn });
        if (!currentSquad) {
            await usersCollection.updateOne({ walletAddress: userWalletAddress }, { $unset: { squadId: "" }, $set: { updatedAt: new Date() } });
            return NextResponse.json({ error: 'Squad data inconsistent, your squad link has been cleared.' }, { status: 404 });
        }
        await squadsCollection.updateOne({ squadId: squadIdUserWasIn }, { $pull: { memberWalletAddresses: userWalletAddress }, $set: { updatedAt: new Date() } });
        await usersCollection.updateOne({ walletAddress: userWalletAddress }, { $unset: { squadId: "" }, $set: { updatedAt: new Date() } });
        const remainingMembers = currentSquad.memberWalletAddresses.filter(wa => wa !== userWalletAddress);
        if (currentSquad.leaderWalletAddress === userWalletAddress) {
            if (remainingMembers.length === 0) {
                await squadsCollection.deleteOne({ squadId: squadIdUserWasIn });
                // No direct recipients for disband if last member leaves, but could log system event or notify admins.
                return NextResponse.json({ message: 'Successfully left and disbanded squad as the sole member.' });
            }
            else {
                const newLeaderWalletAddress = remainingMembers[0];
                await squadsCollection.updateOne({ squadId: squadIdUserWasIn }, { $set: { leaderWalletAddress: newLeaderWalletAddress, updatedAt: new Date() } });
                const newLeaderUserDoc = await usersCollection.findOne({ walletAddress: newLeaderWalletAddress });
                const newLeaderXUsername = newLeaderUserDoc?.xUsername || newLeaderWalletAddress;
                for (const memberAddr of remainingMembers) {
                    await createNotification(db, memberAddr, 'squad_leader_changed', `@${userXUsername} left "${currentSquad.name}". @${newLeaderXUsername} is the new leader.`, squadIdUserWasIn, currentSquad.name, newLeaderWalletAddress, newLeaderXUsername);
                }
            }
        }
        else {
            if (remainingMembers.length > 0) {
                for (const memberAddr of remainingMembers) { // This includes the leader
                    await createNotification(db, memberAddr, 'squad_member_left', `@${userXUsername} has left your squad "${currentSquad.name}".`, squadIdUserWasIn, currentSquad.name, userWalletAddress, userXUsername);
                }
            }
        }
        return NextResponse.json({ message: 'Successfully left squad.' });
    }
    catch (error) {
        console.error("Error leaving squad:", error);
        return NextResponse.json({ error: 'Failed to leave squad' }, { status: 500 });
    }
}
