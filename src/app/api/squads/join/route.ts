import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { rabbitmqService } from '@/services/rabbitmq.service';
import { rabbitmqConfig } from '@/config/rabbitmq.config';

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

    let user = await usersCollection.findOne({ walletAddress: userWalletAddress });
    if (!user) {
      // Auto-create a minimal user record so they can join a squad immediately after wallet connect
      const minimalUser: UserDocument = {
        walletAddress: userWalletAddress,
        xUserId: session.user.xId || session.user.sub || userWalletAddress,
        xUsername: session.user.xUsername || '',
        xProfileImageUrl: session.user.xProfileImageUrl || '',
        points: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;
      const insertRes = await usersCollection.insertOne(minimalUser);
      user = { ...minimalUser, _id: insertRes.insertedId } as any;
    }
    if (!user) {
      return NextResponse.json({ error: 'User record could not be created.' }, { status: 500 });
    }
    if (user.squadId) {
      return NextResponse.json({ error: 'You are already in a squad. Leave your current squad to join another.' }, { status: 400 });
    }

    const squadToJoin = await squadsCollection.findOne({ squadId: squadIdToJoin });
    if (!squadToJoin) {
      return NextResponse.json({ error: 'Squad not found.' }, { status: 404 });
    }

    // Use maxMembers from the squad document if available, otherwise from env/default
    const actualMaxMembers = squadToJoin.maxMembers || MAX_SQUAD_MEMBERS;
    if (squadToJoin.memberWalletAddresses.length >= actualMaxMembers) {
      return NextResponse.json({ error: `This squad is full (max ${actualMaxMembers} members).` }, { status: 400 });
    }

    if (squadToJoin.memberWalletAddresses.includes(userWalletAddress)) {
      // Should not happen if user.squadId check above is working, but as a safeguard:
      return NextResponse.json({ error: 'You are already a member of this squad.' }, { status: 400 });
    }

    const pointsToContribute = user.points || 0;

    // Merged update operation for the squad
    const squadUpdateResult = await squadsCollection.updateOne(
      { squadId: squadIdToJoin },
      {
        $addToSet: { memberWalletAddresses: userWalletAddress },
        $inc: { totalSquadPoints: pointsToContribute }, // From squad-goals
        $set: { updatedAt: new Date() }, // Common, keep
      }
    );

    if (squadUpdateResult.matchedCount === 0) {
      return NextResponse.json({ error: 'Squad not found or no update occurred.' }, { status: 404 });
    }
    console.log(`[Join Squad] Squad ${squadIdToJoin} updated with new member ${userWalletAddress} and points ${pointsToContribute}`);

    // RabbitMQ publish logic from squad-goals
    if (pointsToContribute > 0) {
        try {
            await rabbitmqService.publishToExchange(
                rabbitmqConfig.eventsExchange,
                rabbitmqConfig.routingKeys.squadPointsUpdated,
                {
                    squadId: squadIdToJoin,
                    pointsChange: pointsToContribute,
                    reason: 'user_joined_squad_direct',
                    timestamp: new Date().toISOString(),
                    responsibleUserId: userWalletAddress
                }
            );
            console.log(`[Join Squad] Published squad.points.updated for squad ${squadIdToJoin}`);
        } catch (publishError) {
            console.error(`[Join Squad] Failed to publish squad.points.updated for squad ${squadIdToJoin}:`, publishError);
        }
    }

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