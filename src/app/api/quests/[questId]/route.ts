import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import CommunityQuestModel from '@/models/communityQuest.model';
import { redisService } from '@/services/redis.service';
import { redisConfig } from '@/config/redis.config';
import mongoose, { Types } from 'mongoose';

// Define an interface for the expected quest structure after .lean()
interface LeanCommunityQuest {
  _id: Types.ObjectId; // Or string, depending on how it serializes
  title: string;
  description_md: string;
  goal_type: string;
  goal_target: number;
  goal_target_metadata?: any;
  reward_type: string;
  reward_points?: number;
  reward_nft_id?: string;
  start_ts: Date;
  end_ts: Date;
  status: string;
  created_by?: string;
  created_ts?: Date;
  updated_ts?: Date;
  // Add other fields from your CommunityQuest schema as needed
}

interface RouteContext {
  params: {
    questId: string;
  }
}

// GET - Get a single quest by ID with its progress
export async function GET(request: Request, { params }: RouteContext) {
  const { questId } = params;

  if (!mongoose.Types.ObjectId.isValid(questId)) {
    return NextResponse.json({ error: 'Invalid quest ID format' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    await redisService.connect(); // Ensure Redis is connected

    const quest = await CommunityQuestModel.findById(questId).lean<LeanCommunityQuest>();

    if (!quest) {
      return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    }

    // Fetch progress from Redis
    // quest._id will be an ObjectId here if .lean() preserves it, or string if auto-converted.
    // For consistency with string key in Redis, ensure it's a string.
    const questProgressKey = `${redisConfig.defaultQuestProgressKeyPrefix}${quest._id.toString()}`;
    const progressData = await redisService.get(questProgressKey);

    const questWithProgress = {
      ...quest,
      // Ensure _id is stringified for the response if it's an ObjectId
      _id: quest._id.toString(), 
      progress: progressData ? progressData.current : 0,
      goal: progressData ? progressData.goal : quest.goal_target,
    };

    return NextResponse.json(questWithProgress);
  } catch (error) {
    console.error(`[API Quests GET /${questId}] Error fetching quest details:`, error);
    return NextResponse.json({ error: 'Failed to fetch quest details' }, { status: 500 });
  }
} 