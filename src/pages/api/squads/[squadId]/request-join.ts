import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase, UserDocument, SquadDocument, ISquadJoinRequest } from '@/lib/mongodb';
import { SquadJoinRequest } from '@/models/SquadJoinRequest';
// import { Squad } from '@/models/Squad'; // Not strictly needed if using db.collection for reads
// import { User } from '@/models/User'; // Not strictly needed if using db.collection for reads
import { createNotification } from '@/lib/notificationUtils'; // Notify leader when request created

interface RequestJoinBody {
  message?: string;
}

export async function POST(request: Request, { params }: { params: { squadId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  const { squadId } = params;
  if (!squadId) {
    return NextResponse.json({ error: 'Squad ID is required' }, { status: 400 });
  }

  let requestBody: RequestJoinBody;
  try {
    requestBody = await request.json();
  } catch (e) {
    requestBody = {}; // Assume no message if body is not valid JSON or empty
  }
  const { message } = requestBody;

  const userWalletAddress = session.user.walletAddress;

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const squadsCollection = db.collection<SquadDocument>('squads');
    const squadJoinRequestsCollection = db.collection<ISquadJoinRequest>('squadjoinrequests'); // Mongoose auto-pluralizes and lowercases

    // 1. Check if user is already in a squad
    const currentUser = await usersCollection.findOne({ walletAddress: userWalletAddress });
    if (!currentUser) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }
    if (currentUser.squadId) {
      return NextResponse.json({ error: 'You are already in a squad. Leave your current squad to request to join another.' }, { status: 400 });
    }

    // 2. Check if the target squad exists
    const targetSquad = await squadsCollection.findOne({ squadId: squadId });
    if (!targetSquad) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    // 3. Check if user already has a PENDING request for this squad
    const existingRequest = await squadJoinRequestsCollection.findOne({
      squadId: squadId,
      requestingUserWalletAddress: userWalletAddress,
      status: 'pending'
    });

    if (existingRequest) {
      return NextResponse.json({ error: 'You already have a pending request to join this squad.' }, { status: 400 });
    }

    // 4. Create the join request
    const newJoinRequest = new SquadJoinRequest({
      squadId: targetSquad.squadId,
      squadName: targetSquad.name, // Denormalized squad name
      requestingUserWalletAddress: userWalletAddress,
      requestingUserXUsername: session.user.xUsername, // Denormalized from session
      requestingUserXProfileImageUrl: session.user.xProfileImageUrl, // Denormalized from session
      status: 'pending',
      message: message, // Optional message from user
    });

    await newJoinRequest.save();

    // 5. Notify squad leader
    await createNotification(
      db,
      targetSquad.leaderWalletAddress,
      'squad_join_request_received',
      `${session.user.xUsername ? '@' + session.user.xUsername : userWalletAddress.substring(0,6)} wants to join your squad "${targetSquad.name}"`,
      targetSquad.squadId,
      targetSquad.name,
      userWalletAddress,
      session.user.xUsername || undefined,
      newJoinRequest.requestId
    );

    return NextResponse.json({ message: 'Request to join squad sent successfully!', requestId: newJoinRequest.requestId }, { status: 201 });

  } catch (error) {
    console.error("Error requesting to join squad:", error);
    return NextResponse.json({ error: 'Failed to send request to join squad' }, { status: 500 });
  }
} 