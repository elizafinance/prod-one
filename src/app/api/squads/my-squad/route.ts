import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Enriched types for squad details (can be shared if moved to a types file)
interface EnrichedSquadMember {
  walletAddress: string;
  xUsername?: string;
  xProfileImageUrl?: string;
  points?: number;
}

// Define the expected response structure
interface MySquadApiResponse {
  squad: (SquadDocument & { 
    membersFullDetails?: EnrichedSquadMember[]; 
    totalSquadPoints?: number; 
    leaderReferralCode?: string; 
  }) | null; // Squad can be null if user is not in one
  message?: string; // Optional message (e.g., "User is not currently in a squad")
  error?: string; // Added optional error field
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  console.log('[MySquadAPI] Session:', JSON.stringify(session));
  // Step 1: Basic authentication - is the user logged in via NextAuth?
  if (!session || !session.user || !session.user.xId) { // Check for xId as the primary session identifier
    console.warn('[MySquadAPI] Not authenticated or xId missing. Session:', session);
    return NextResponse.json({ error: 'User not authenticated or xId missing from session' }, { status: 401 });
  }
  const userXId = session.user.xId;

  // The frontend might still send userWalletAddress as a query param (from connected wallet)
  const { searchParams } = new URL(request.url);
  const clientProvidedWalletAddress = searchParams.get('userWalletAddress');
  console.log('[MySquadAPI] Query param userWalletAddress:', clientProvidedWalletAddress);

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const squadsCollection = db.collection<SquadDocument>('squads');

    // Step 2: Fetch the user from DB using the authenticated xId to get their canonical walletAddress
    const userFromDb = await usersCollection.findOne({ xUserId: userXId });
    console.log('[MySquadAPI] DB lookup result for xUserId', userXId, ':', userFromDb);
    if (!userFromDb) {
      console.error('[MySquadAPI] User not found in DB for xUserId:', userXId);
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
      // Edge-case self-healing: the user might actually lead a squad but their user record lacks squadId
      const possibleLeaderSquad = await squadsCollection.findOne({ leaderWalletAddress: userFromDb.walletAddress });
      if (possibleLeaderSquad) {
        await usersCollection.updateOne({ _id: userFromDb._id }, { $set: { squadId: possibleLeaderSquad.squadId, updatedAt: new Date() } });
        userFromDb.squadId = possibleLeaderSquad.squadId;
      }
    }

    if (!userFromDb.squadId) {
      const response: MySquadApiResponse = { message: 'User is not currently in a squad.', squad: null };
      return NextResponse.json(response, { status: 200 });
    }

    const squad = await squadsCollection.findOne({ squadId: userFromDb.squadId });
    if (!squad) {
      // Data inconsistency, clear user's squadId from their DB record
      await usersCollection.updateOne({ xUserId: userXId }, { $unset: { squadId: "" }, $set: {updatedAt: new Date()} });
      const response: MySquadApiResponse = { error: 'Squad not found, user data corrected. Please try joining a squad again.', squad: null };
      return NextResponse.json(response, { status: 404 });
    }
    
    // Fetch full member details and calculate points (similar to details/[squadId] route)
    const membersFullDetails: EnrichedSquadMember[] = [];
    let calculatedTotalSquadPoints = 0;

    if (squad.memberWalletAddresses && squad.memberWalletAddresses.length > 0) {
      const memberUsers = await usersCollection.find(
        { walletAddress: { $in: squad.memberWalletAddresses } },
        { projection: { walletAddress: 1, xUsername: 1, xProfileImageUrl: 1, points: 1, _id: 0 } }
      ).toArray();
      
      const memberUserMap = new Map<string, Partial<UserDocument>>();
      memberUsers.forEach(member => {
        if (member.walletAddress) {
          memberUserMap.set(member.walletAddress, member);
        }
      });

      for (const walletAddr of squad.memberWalletAddresses) {
        const memberDetail = memberUserMap.get(walletAddr);
        const memberPoints = memberDetail?.points || 0;
        membersFullDetails.push({
          walletAddress: walletAddr,
          xUsername: memberDetail?.xUsername,
          xProfileImageUrl: memberDetail?.xProfileImageUrl,
          points: memberPoints,
        });
        calculatedTotalSquadPoints += memberPoints;
      }
    }

    // Fetch leader's referral code
    let leaderReferralCode: string | undefined = undefined;
    if (squad.leaderWalletAddress) {
      const leaderUser = await usersCollection.findOne(
        { walletAddress: squad.leaderWalletAddress },
        { projection: { _id: 0, referralCode: 1 } }
      );
      leaderReferralCode = leaderUser?.referralCode;
    }
    
    const responsePayload: MySquadApiResponse = {
      squad: {
        ...squad,
        membersFullDetails,
        totalSquadPoints: calculatedTotalSquadPoints,
        leaderReferralCode,
      }
    };
    
    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error("Error fetching user's squad:", error);
    const response: MySquadApiResponse = { error: 'Failed to fetch squad information', squad: null };
    return NextResponse.json(response, { status: 500 });
  }
} 