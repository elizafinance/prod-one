import { NextResponse } from 'next/server';
import { connectToDatabase, SquadDocument } from '@/lib/mongodb';

const SQUAD_LEADERBOARD_LIMIT = 20; // Example limit

export async function GET(request: Request) {
  try {
    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');

    const leaderboard = await squadsCollection
      .find(
        {},
        {
          projection: { // Only return necessary fields for the leaderboard
            squadId: 1,
            name: 1,
            description: 1,
            leaderWalletAddress: 1, // Might be useful to show leader's (masked) address or name
            memberCount: { $size: "$memberWalletAddresses" }, // Dynamically calculate member count
            totalSquadPoints: 1,
            _id: 0,
          },
        }
      )
      .sort({ totalSquadPoints: -1 }) // Sort by points descending
      .limit(SQUAD_LEADERBOARD_LIMIT)
      .toArray();

    // You might want to fetch leader usernames here if desired for a richer display,
    // but that would involve more DB lookups.

    return NextResponse.json(leaderboard);

  } catch (error) {
    console.error("Error fetching squad leaderboard:", error);
    return NextResponse.json({ error: 'Failed to fetch squad leaderboard data' }, { status: 500 });
  }
} 