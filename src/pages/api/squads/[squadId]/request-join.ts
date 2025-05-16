import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase, UserDocument, SquadDocument, ISquadJoinRequest } from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';
// import { Squad } from '@/models/Squad'; // Not strictly needed if using db.collection for reads
// import { User } from '@/models/User'; // Not strictly needed if using db.collection for reads
import { createNotification } from '@/lib/notificationUtils'; // Notify leader when request created

interface RequestJoinBody {
  message?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || !session.user.walletAddress) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const { squadId } = req.query;
  if (!squadId || typeof squadId !== 'string') {
    return res.status(400).json({ error: 'Squad ID is required' });
  }

  const requestBody: RequestJoinBody = req.body || {};
  const { message } = requestBody;

  const userWalletAddress = session.user.walletAddress;

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const squadsCollection = db.collection<SquadDocument>('squads');
    const squadJoinRequestsCollection = db.collection<ISquadJoinRequest>('squadjoinrequests');

    let currentUser = await usersCollection.findOne({ walletAddress: userWalletAddress });
    // Auto-create a minimal user profile if none exists (prevents race condition on first ever action)
    if (!currentUser) {
      const newUser: UserDocument = {
        walletAddress: userWalletAddress,
        xUserId: session.user.id || session.user.sub || userWalletAddress, // fallback to wallet address if xId unavailable
        xUsername: session.user.xUsername || '',
        xProfileImageUrl: session.user.xProfileImageUrl || '',
        points: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const insertRes = await usersCollection.insertOne(newUser);
      currentUser = { ...newUser, _id: insertRes.insertedId } as any;
      console.log(`[Request Join] Auto-created minimal user profile for ${userWalletAddress}`);
    }
    if (currentUser && currentUser.squadId) {
      return res.status(400).json({ error: 'You are already in a squad. Leave your current squad to request to join another.' });
    }

    const targetSquad = await squadsCollection.findOne({ squadId: squadId });
    if (!targetSquad) {
      return res.status(404).json({ error: 'Squad not found' });
    }

    const existingRequest = await squadJoinRequestsCollection.findOne({
      squadId: squadId,
      requestingUserWalletAddress: userWalletAddress,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'You already have a pending request to join this squad.' });
    }

    const requestId = uuidv4();

    const newJoinRequest: ISquadJoinRequest = {
      requestId,
      squadId: targetSquad.squadId,
      squadName: targetSquad.name,
      requestingUserWalletAddress: userWalletAddress,
      requestingUserXUsername: session.user.xUsername,
      requestingUserXProfileImageUrl: session.user.xProfileImageUrl,
      status: 'pending',
      message: message,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as ISquadJoinRequest;

    await squadJoinRequestsCollection.insertOne(newJoinRequest);

    await createNotification(
      db,
      targetSquad.leaderWalletAddress,
      'squad_join_request_received',
      `${session.user.xUsername ? '@' + session.user.xUsername : userWalletAddress.substring(0,6)} wants to join your squad "${targetSquad.name}"`,
      targetSquad.squadId,
      targetSquad.name,
      userWalletAddress,
      session.user.xUsername || undefined,
      requestId
    );

    return res.status(201).json({ message: 'Request to join squad sent successfully!', requestId });

  } catch (error) {
    console.error("Error requesting to join squad:", error);
    return res.status(500).json({ error: 'Failed to send request to join squad' });
  }
} 