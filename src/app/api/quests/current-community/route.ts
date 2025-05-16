import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Define a simple interface for a CommunityQuest document
// Adjust this based on your actual CommunityQuest schema in MongoDB
interface CommunityQuest {
  _id: ObjectId;
  title: string;
  description: string;
  reward: string;
  progress?: number; // Current progress, might be calculated or stored
  target: number;
  status: 'active' | 'inactive' | 'completed'; // Example statuses
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(); // Use your default DB or specify one

    // Fetch the most recent active community quest.
    // Sorted by createdAt descending to get the latest one first.
    const currentQuest = await db.collection<CommunityQuest>('communityQuests')
      .find({ status: 'active' }) // Filter by active quests
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    if (currentQuest.length === 0) {
      return NextResponse.json({ error: 'No active community quests found' }, { status: 404 });
    }

    const questData = {
      ...currentQuest[0],
      id: currentQuest[0]._id.toString(), // ensure id is a string for client-side use
    };

    return NextResponse.json(questData);
  } catch (error) {
    console.error("Failed to fetch current community quest:", error);
    return NextResponse.json({ error: 'Failed to fetch current community quest' }, { status: 500 });
  }
} 