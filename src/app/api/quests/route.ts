import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import CommunityQuest from '@/models/communityQuest.model';
import { redisService } from '@/services/redis.service'; // Assuming path based on previous setup
import { redisConfig } from '@/config/redis.config';   // Assuming path

// GET - List active quests with their progress
export async function GET(request: Request) {
  try {
    await connectToDatabase();
    // Connect to Redis (it handles singleton internally)
    await redisService.connect(); 

    const activeQuests = await CommunityQuest.find({
      status: 'active',
      // Optionally add date filters, e.g., end_ts: { $gte: new Date() }
    }).sort({ end_ts: 1 }) // Sort by soonest ending, or by start_ts
      .lean();

    const questsWithProgress = await Promise.all(
      activeQuests.map(async (quest) => {
        const questProgressKey = `${redisConfig.defaultQuestProgressKeyPrefix}${quest._id}`;
        const progressData = await redisService.get(questProgressKey);
        return {
          ...quest,
          progress: progressData ? progressData.current : 0, // Default to 0 if no progress in Redis
          goal: progressData ? progressData.goal : quest.goal_target, // Goal from Redis or fallback to quest doc
          // last_progress_update_at: progressData ? progressData.updated_at : null, // Optional
        };
      })
    );

    return NextResponse.json(questsWithProgress);
  } catch (error) {
    console.error('[API Quests GET] Error fetching active quests:', error);
    return NextResponse.json({ error: 'Failed to fetch active quests' }, { status: 500 });
  }
} 