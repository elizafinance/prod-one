import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  // Step 1: Basic authentication - is the user logged in via NextAuth?
  if (!session || !session.user || !session.user.xId) { // Check for xId as the primary session identifier
    return NextResponse.json({ error: 'User not authenticated or xId missing from session' }, { status: 401 });
  }
  const userXId = session.user.xId;

  // The frontend might still send userWalletAddress as a query param (from connected wallet)
  const { searchParams } = new URL(request.url);
  const clientProvidedWalletAddress = searchParams.get('userWalletAddress');

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const squadsCollection = db.collection<SquadDocument>('squads');

    // Step 2: Fetch the user from DB using the authenticated xId to get their canonical walletAddress
    const userFromDb = await usersCollection.findOne({ xId: userXId });
    if (!userFromDb) {
      return NextResponse.json({ error: 'User record not found in database for authenticated xId.' }, { status: 404 });
    }
    
    // Step 3: If client provided a wallet address, ensure it matches the one in DB for this xId.
    // This is an important security/consistency check.
    if (clientProvidedWalletAddress && userFromDb.walletAddress !== clientProvidedWalletAddress) {
        console.warn(`[My Squad API] Client wallet ${clientProvidedWalletAddress} does not match DB wallet ${userFromDb.walletAddress} for xId ${userXId}`);
        return NextResponse.json({ error: 'Wallet address mismatch.' }, { status: 403 }); // Forbidden
    }
    
    const authoritativeWalletAddress = userFromDb.walletAddress; // This is the trusted wallet address

    if (!userFromDb.squadId) {
      return NextResponse.json({ message: 'User is not currently in a squad.', squad: null }, { status: 200 });
    }

    const squad = await squadsCollection.findOne({ squadId: userFromDb.squadId });
    if (!squad) {
      // Data inconsistency, clear user's squadId from their DB record
      await usersCollection.updateOne({ xId: userXId }, { $unset: { squadId: "" }, $set: {updatedAt: new Date()} });
      return NextResponse.json({ error: 'Squad not found, user data corrected. Please try joining a squad again.', squad: null }, { status: 404 });
    }
    
    return NextResponse.json({ squad });

  } catch (error) {
    console.error("Error fetching user's squad:", error);
    return NextResponse.json({ error: 'Failed to fetch squad information' }, { status: 500 });
  }
} 