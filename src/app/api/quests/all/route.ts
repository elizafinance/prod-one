import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ensureMongooseConnected } from '@/lib/mongooseConnect';
import CommunityQuest from '@/models/communityQuest.model.js';
import { redisService } from '@/services/redis.service';
import { redisConfig } from '@/config/redis.config';
import { Types } from 'mongoose';

// Define an interface based on the lean Mongoose document and expected fields
// This should align with your communityQuestSchema and what you return to the client
interface ICommunityQuest {
  _id: Types.ObjectId | string; // lean() might return ObjectId, but we stringify it
  title: string;
  description?: string;
  status: string; // Keeping it string for flexibility from DB
  scope?: string;
  goal_type?: string;
  goal_target?: number;
  goal_units?: string; // Added based on your page.tsx usage
  progress?: number; // This might come from Redis or the quest doc itself
  start_ts?: Date | string;
  end_ts?: Date | string;
  rewards?: Array<{ type: string; value: any; description?: string }>;
  reward_description?: string; // Simplified reward fields for client, derived from rewards array if needed
  reward_points?: number;      // Simplified reward fields for client
  // Add other fields you use from the schema
}

// GET - List active quests with their progress
export async function GET(request: Request) {
  console.log('[API /quests/all] Received request');
  try {
    await connectToDatabase();
    console.log('[API /quests/all] Connected to DB');
    await ensureMongooseConnected();
    console.log('[API /quests/all] Mongoose connected');
    await redisService.connect();
    console.log('[API /quests/all] Redis connected');

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope'); // 'community' | 'squad'
    const statusParam = searchParams.get('status'); // Allow fetching by specific status if provided

    const now = new Date();
    console.log(`[API /quests/all] Current server time (UTC): ${now.toISOString()}`);

    const query: any = {};
    if (scope) query.scope = scope;

    // If no specific status is requested, default to finding quests that *should* be active by date
    if (!statusParam) {
      console.log('[API /quests/all] No status param, defaulting to date-based active/scheduled logic');
      query.$and = [
        { start_ts: { $lte: now } }, // Should have started
        { end_ts: { $gte: now } }    // Not yet ended
      ];
      query.status = { $in: ['active', 'scheduled'] }; // DB status can be active or scheduled
    } else {
      console.log(`[API /quests/all] Status param provided: ${statusParam}`);
      query.status = statusParam;
    }
    
    console.log('[API /quests/all] MongoDB Query:', JSON.stringify(query));

    const questsFromDB: ICommunityQuest[] = await CommunityQuest.find(query)
      .sort({ end_ts: 1 }) 
      .lean<ICommunityQuest[]>();

    console.log(`[API /quests/all] Found ${questsFromDB.length} quests from DB with query.`);
    if (questsFromDB.length > 0) {
        questsFromDB.forEach((q: ICommunityQuest) => {
            console.log(`[API /quests/all] Quest from DB: ID=${q._id}, Title='${q.title}', DB_Status='${q.status}', Start='${q.start_ts}', End='${q.end_ts}'`);
        });
    }

    const processedQuests = await Promise.all(
      questsFromDB.map(async (quest: ICommunityQuest) => {
        let displayStatus = quest.status;
        // If no specific status was requested by client, override DB 'scheduled' to 'active' if dates match
        if (!statusParam && quest.start_ts && quest.end_ts) {
            const startTime = new Date(quest.start_ts);
            const endTime = new Date(quest.end_ts);
            if (quest.status === 'scheduled' && startTime <= now && endTime >= now) {
                displayStatus = 'active';
                console.log(`[API /quests/all] Overriding status to 'active' for quest ID ${quest._id} based on dates.`);
            }
        }

        // Fetch progress from Redis (optional, remove if not using Redis for this list)
        let progressData = null;
        try {
            const questProgressKey = `${redisConfig.defaultQuestProgressKeyPrefix}${quest._id.toString()}`;
            progressData = await redisService.get(questProgressKey);
        } catch (redisError) {
            console.warn(`[API /quests/all] Redis error for quest ${quest._id.toString()}:`, redisError);
        }

        // Derive simplified reward fields if not directly available
        // This is an example; adjust based on how you want to represent rewards from the `rewards` array
        let derivedRewardDesc = quest.reward_description;
        let derivedRewardPoints = quest.reward_points;
        if (quest.rewards && quest.rewards.length > 0) {
            const pointsReward = quest.rewards.find(r => r.type === 'points');
            if (pointsReward) derivedRewardPoints = Number(pointsReward.value) || undefined;
            if (!derivedRewardDesc) {
                derivedRewardDesc = quest.rewards.map(r => r.description || `${r.value} ${r.type}`).join(', ');
            }
        }

        return {
          _id: quest._id.toString(),
          title: quest.title,
          description: quest.description,
          status: displayStatus,
          goal_target: quest.goal_target,
          progress: progressData ? progressData.current : (quest.progress || 0), 
          goal_units: quest.goal_units,
          reward_description: derivedRewardDesc,
          reward_points: derivedRewardPoints,
          start_ts: quest.start_ts ? new Date(quest.start_ts).toISOString() : undefined,
          end_ts: quest.end_ts ? new Date(quest.end_ts).toISOString() : undefined,
          id: quest._id.toString(),
        };
      })
    );
    console.log(`[API /quests/all] Returning ${processedQuests.length} processed quests.`);
    return NextResponse.json(processedQuests);
  } catch (error: any) {
    console.error('[API /quests/all] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch quests', details: error.message }, { status: 500 });
  }
} 