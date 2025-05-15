import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth"; // Corrected import path
import profanityList from '@/data/profanity-list.json'; // Import the profanity list

interface CreateSquadRequestBody {
  squadName: string;
  description?: string;
  // leaderWalletAddress is now derived from session
}

// Squad tier configuration from environment variables with defaults
const TIER_1_POINTS = parseInt(process.env.TIER_1_POINTS || '1000');
const TIER_2_POINTS = parseInt(process.env.TIER_2_POINTS || '5000');
const TIER_3_POINTS = parseInt(process.env.TIER_3_POINTS || '10000');
const TIER_1_MAX_MEMBERS = parseInt(process.env.TIER_1_MAX_MEMBERS || '10');
const TIER_2_MAX_MEMBERS = parseInt(process.env.TIER_2_MAX_MEMBERS || '50');
const TIER_3_MAX_MEMBERS = parseInt(process.env.TIER_3_MAX_MEMBERS || '100');

// Function to determine squad tier and max members based on points
function getSquadTierInfo(points: number): { tier: number, maxMembers: number } {
  if (points >= TIER_3_POINTS) return { tier: 3, maxMembers: TIER_3_MAX_MEMBERS };
  if (points >= TIER_2_POINTS) return { tier: 2, maxMembers: TIER_2_MAX_MEMBERS };
  if (points >= TIER_1_POINTS) return { tier: 1, maxMembers: TIER_1_MAX_MEMBERS };
  return { tier: 0, maxMembers: 0 }; // Not eligible
}

// Function to check for profanity (simple case-insensitive check)
function containsProfanity(name: string, list: string[]): boolean {
  const lowerCaseName = name.toLowerCase();
  return list.some(badWord => lowerCaseName.includes(badWord.toLowerCase()));
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') { 
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const leaderWalletAddress = session.user.walletAddress;

  try { // Moved try block to encompass body parsing and subsequent logic
    const body: CreateSquadRequestBody = await request.json();
    const { squadName, description } = body;

    if (!squadName) {
      return NextResponse.json({ error: 'Squad name is required' }, { status: 400 });
    }

    if (squadName.length < 3 || squadName.length > 30) {
      return NextResponse.json({ error: 'Squad name must be between 3 and 30 characters' }, { status: 400 });
    }

    // Profanity check
    if (containsProfanity(squadName, profanityList)) {
      return NextResponse.json({ error: 'Squad name contains inappropriate language. Please choose another name.' }, { status: 400 });
    }
    // Also check description if you want
    if (description && containsProfanity(description, profanityList)) {
      return NextResponse.json({ error: 'Squad description contains inappropriate language.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');
    const usersCollection = db.collection<UserDocument>('users');

    const leaderUser = await usersCollection.findOne({ walletAddress: leaderWalletAddress });
    let userDoc = leaderUser;
    if (!userDoc) {
      // Fallback lookup by xUserId if wallet not yet linked in DB
      const xUserId = (session.user as any).xId;
      if (xUserId) {
        userDoc = await usersCollection.findOne({ xUserId });
      }
    }
    if (!userDoc) {
      return NextResponse.json({ error: 'Authenticated leader user not found in database. Please complete wallet linking first.' }, { status: 404 });
    }
    
    const userPoints = userDoc.points || 0;
    const { tier, maxMembers } = getSquadTierInfo(userPoints);
    
    if (tier === 0) {
      return NextResponse.json({ 
        error: `You need at least ${TIER_1_POINTS.toLocaleString()} DeFAI Points to create a squad.` 
      }, { status: 403 });
    }
    
    if (userDoc.squadId) {
      return NextResponse.json({ error: 'You are already in a squad. Leave your current squad to create a new one.' }, { status: 400 });
    }

    const existingSquad = await squadsCollection.findOne({ name: squadName });
    if (existingSquad) {
      return NextResponse.json({ error: 'A squad with this name already exists.' }, { status: 400 });
    }

    const newSquadId = uuidv4();
    const initialSquadPoints = userPoints;

    const newSquad: SquadDocument = {
      squadId: newSquadId,
      name: squadName,
      description: description || '',
      leaderWalletAddress: leaderWalletAddress,
      memberWalletAddresses: [leaderWalletAddress],
      maxMembers: maxMembers,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await squadsCollection.insertOne(newSquad);

    await usersCollection.updateOne(
      { walletAddress: leaderWalletAddress },
      { 
        $set: { 
          squadId: newSquadId, 
          updatedAt: new Date() 
        }
      }
    );

    return NextResponse.json({ 
      message: 'Squad created successfully!', 
      squadId: newSquadId,
      squad: newSquad 
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating squad:", error);
    if (error instanceof SyntaxError) { 
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create squad' }, { status: 500 });
  }
} 