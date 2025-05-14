import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
export async function GET(request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
        return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const twitterHandle = searchParams.get('handle');
    if (!twitterHandle) {
        return NextResponse.json({ error: 'Twitter handle is required' }, { status: 400 });
    }
    try {
        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');
        // Remove @ if included in the search
        const normalizedHandle = twitterHandle.startsWith('@')
            ? twitterHandle.substring(1)
            : twitterHandle;
        // Find user by Twitter username (case insensitive)
        const user = await usersCollection.findOne({
            xUsername: { $regex: new RegExp(`^${normalizedHandle}$`, 'i') }
        });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        // Return minimal user data needed for invitation
        return NextResponse.json({
            walletAddress: user.walletAddress,
            xUsername: user.xUsername,
            xProfileImageUrl: user.xProfileImageUrl
        });
    }
    catch (error) {
        console.error("Error finding user by Twitter handle:", error);
        return NextResponse.json({ error: 'Failed to find user' }, { status: 500 });
    }
}
