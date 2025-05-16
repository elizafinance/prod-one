import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { redisService } from '@/services/redis.service';
import { redisConfig } from '@/config/redis.config';

// Define a simple interface for a CommunityQuest document
// Adjust this based on your actual CommunityQuest schema in MongoDB
interface CommunityQuest {
  _id: ObjectId;
  title: string;
  description: string;
  reward: string;
  progress?: number; // Current progress, might be calculated or stored
  target: number;
  status: 'active' | 'scheduled' | 'inactive' | 'completed'; // Example statuses
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db();

    await redisService.connect();

    const now = new Date();

    const questDoc = await db.collection('communityQuests')
      .find({
        scope: 'community',
        status: { $in: ['active', 'scheduled'] },
        start_ts: { $lte: now },
        end_ts: { $gte: now },
      })
      .sort({ end_ts: 1 })
      .limit(1)
      .next();

    if (!questDoc) {
      return NextResponse.json({ error: 'No active community quests found' }, { status: 404 });
    }

    // get progress from redis if exists
    let progress = questDoc.progress || 0;
    try {
      const progressKey = `${redisConfig.defaultQuestProgressKeyPrefix}${questDoc._id.toString()}`;
      const redisData = await redisService.get(progressKey);
      if (redisData && redisData.current !== undefined) {
        progress = redisData.current;
      }
    } catch (e) {
      console.warn('[quests/current-community] Redis error', e);
    }

    const result = {
      id: questDoc._id.toString(),
      _id: questDoc._id.toString(),
      title: questDoc.title,
      description: questDoc.description,
      reward: questDoc.rewards?.[0]?.description || questDoc.rewards?.[0]?.value || '',
      progress,
      target: (questDoc as any).goal_target ?? 0,
      status: questDoc.status,
      start_ts: (questDoc as any).start_ts,
      end_ts: (questDoc as any).end_ts,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch current community quest:", error);
    return NextResponse.json({ error: 'Failed to fetch current community quest' }, { status: 500 });
  }
} 