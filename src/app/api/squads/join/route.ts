import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

interface JoinSquadRequestBody {
  squadIdToJoin: string;
  // userWalletAddress is now derived from session
}

// Default max members if environment variable is not set or invalid
const DEFAULT_MAX_SQUAD_MEMBERS = 10;
const MAX_SQUAD_MEMBERS = parseInt(process.env.MAX_SQUAD_MEMBERS || '') || DEFAULT_MAX_SQUAD_MEMBERS;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const userWalletAddress = session.user.walletAddress;

  try {
    const body: JoinSquadRequestBody = await request.json();
    const { squadIdToJoin } = body;

    if (!squadIdToJoin) {
      return NextResponse.json({ error: 'Squad ID to join is required' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');
    const usersCollection = db.collection<UserDocument>('users');

    const user = await usersCollection.findOne({ walletAddress: userWalletAddress });
    if (!user) {
      return NextResponse.json({ error: 'Authenticated user not found in database.' }, { status: 404 });
    }
    if (user.squadId) {
      return NextResponse.json({ error: 'You are already in a squad. Leave your current squad to join another.' }, { status: 400 });
    }

    const squadToJoin = await squadsCollection.findOne({ squadId: squadIdToJoin });
    if (!squadToJoin) {
      return NextResponse.json({ error: 'Squad not found.' }, { status: 404 });
    }

    if (squadToJoin.memberWalletAddresses.length >= MAX_SQUAD_MEMBERS) {
      return NextResponse.json({ error: `This squad is full (max ${MAX_SQUAD_MEMBERS} members).` }, { status: 400 });
    }

    if (squadToJoin.memberWalletAddresses.includes(userWalletAddress)) {
      // Should not happen if user.squadId check above is working, but as a safeguard:
      return NextResponse.json({ error: 'You are already a member of this squad.' }, { status: 400 });
    }

    const pointsToContribute = user.points || 0;

    // Add user to squad's member list and add their points to squad total
    await squadsCollection.updateOne(
      { squadId: squadIdToJoin },
      {
        $addToSet: { memberWalletAddresses: userWalletAddress },
        $inc: { totalSquadPoints: pointsToContribute }, // Add joining member's points
        $set: { updatedAt: new Date() }
      }
    );

    // Update user's document with squadId
    // Optionally, update user.pointsContributedToSquad if you implement that field
    await usersCollection.updateOne(
      { walletAddress: userWalletAddress },
      { 
        $set: { 
          squadId: squadIdToJoin, 
          // pointsContributedToSquad: pointsToContribute, // If tracking
          updatedAt: new Date() 
        }
      }
    );

    return NextResponse.json({ message: `Successfully joined squad: ${squadToJoin.name}. You contributed ${pointsToContribute} points to the squad!` });

  } catch (error) {
    console.error("Error joining squad:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to join squad' }, { status: 500 });
  }
} 