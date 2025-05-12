import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const userWalletAddress = session.user.walletAddress;

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const squadsCollection = db.collection<SquadDocument>('squads');

    const user = await usersCollection.findOne({ walletAddress: userWalletAddress });
    if (!user) {
      return NextResponse.json({ error: 'Authenticated user not found in database.' }, { status: 404 });
    }

    if (!user.squadId) {
      return NextResponse.json({ message: 'User is not currently in a squad.', squad: null }, { status: 200 });
    }

    const squad = await squadsCollection.findOne({ squadId: user.squadId });
    if (!squad) {
      await usersCollection.updateOne({ walletAddress: userWalletAddress }, { $unset: { squadId: "" } });
      return NextResponse.json({ error: 'Squad not found, user data corrected. Please try joining a squad again.', squad: null }, { status: 404 });
    }
    
    return NextResponse.json({ squad });

  } catch (error) {
    console.error("Error fetching user's squad:", error);
    return NextResponse.json({ error: 'Failed to fetch squad information' }, { status: 500 });
  }
} 