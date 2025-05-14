import { NextResponse } from 'next/server';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase, SquadDocument, ISquadJoinRequest } from '@/lib/mongodb';
// SquadJoinRequest model is not directly used here for new doc creation, db.collection is used for reads.

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { squadId } = req.query;
  if (!squadId || typeof squadId !== 'string') {
    return res.status(400).json({ error: 'Squad ID is required' });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session || !session.user || !session.user.walletAddress) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const userWalletAddress = session.user.walletAddress;

  try {
    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');
    const squadJoinRequestsCollection = db.collection<ISquadJoinRequest>('squadjoinrequests');

    // 1. Verify the current user is the leader of the squad
    const squad = await squadsCollection.findOne({ squadId });
    if (!squad) {
      return res.status(404).json({ error: 'Squad not found' });
    }

    if (squad.leaderWalletAddress !== userWalletAddress) {
      return res.status(403).json({ error: 'Only the squad leader can view join requests.' });
    }

    // 2. Fetch pending join requests for this squad
    const pendingRequests = await squadJoinRequestsCollection.find({
      squadId: squadId,
      status: 'pending'
    }).sort({ createdAt: -1 }).toArray();

    const enriched = pendingRequests.map(r => ({
      ...r,
      displayUsername: r.requestingUserXUsername || r.requestingUserWalletAddress.substring(0,6) + '...' + r.requestingUserWalletAddress.slice(-4)
    }));

    return res.status(200).json({ requests: enriched });

  } catch (error) {
    console.error('Error fetching squad join requests:', error);
    return res.status(500).json({ error: 'Failed to fetch squad join requests' });
  }
} 