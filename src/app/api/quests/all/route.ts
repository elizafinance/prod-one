import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ensureMongooseConnected } from '@/lib/mongooseConnect';
import CommunityQuest from '@/models/communityQuest.model';
import { redisService } from '@/services/redis.service'; // Assuming path based on previous setup
import { redisConfig } from '@/config/redis.config';   // Assuming path

// GET - List active quests with their progress
export async function GET(request: Request) {
  try {
    await connectToDatabase();
    await ensureMongooseConnected();
    await redisService.connect();

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope'); // 'community' | 'squad'
    const statusParam = searchParams.get('status') || 'active'; // default active

    const now = new Date();
    const query: any = {};
    if (scope) query.scope = scope;

    if (statusParam === 'active') {
      // Treat as currently running quests (start<=now<=end) even if doc status is still 'scheduled'
      query.$and = [
        { start_ts: { $lte: now } },
        { end_ts: { $gte: now } }
      ];
      query.status = { $in: ['active', 'scheduled'] };
    } else if (statusParam) {
      query.status = statusParam;
    }

    const activeQuests = await CommunityQuest.find(query)
      .sort({ end_ts: 1 }) // Sort by soonest ending, or by start_ts
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