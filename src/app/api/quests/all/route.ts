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

interface ICommunityQuestFromDB {
  _id: Types.ObjectId; // Expect ObjectId from Mongoose .lean() unless transformed
  title: string;
  description?: string;
  status: string; 
  scope?: string;
  goal_type?: string;
  goal_target?: number;
  goal_units?: string; 
  progress?: number; 
  start_ts?: Date | string; // Could be Date object or string from DB/lean
  end_ts?: Date | string;
  rewards?: Array<{ type: string; value: any; description?: string }>;
  reward_description?: string;
  reward_points?: number;
  // Add other fields from your actual schema
}

// Interface for the data structure we send to the client
interface IProcessedQuest {
  _id: string;
  id: string;
  title: string;
  description?: string;
  status: string;
  goal_target?: number;
  progress?: number;
  goal_units?: string;
  reward_description?: string;
  reward_points?: number;
  start_ts?: string; // ISO string
  end_ts?: string;   // ISO string
}

// GET - List active quests with their progress
export async function GET(request: Request) {
  console.log('[API /quests/all] Received request');
  try {
    await connectToDatabase();
    await ensureMongooseConnected();
    await redisService.connect();
    console.log('[API /quests/all] Connections established.');

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope'); 
    const statusParam = searchParams.get('status');

    const now = new Date();
    console.log(`[API /quests/all] Current server time (UTC): ${now.toISOString()}`);
    console.log(`[API /quests/all] statusParam from URL: '${statusParam}' (type: ${typeof statusParam})`);

    const query: any = {};
    if (scope) query.scope = scope;

    if (!statusParam || statusParam === 'active_or_scheduled_by_date') { // More explicit default intention
      console.log('[API /quests/all] Applying date-based active/scheduled logic');
      query.$and = [
        { start_ts: { $lte: now } }, 
        { end_ts: { $gte: now } }    
      ];
      query.status = { $in: ['active', 'scheduled'] }; 
    } else {
      console.log(`[API /quests/all] Status param provided: ${statusParam}`);
      query.status = statusParam;
    }
    
    console.log('[API /quests/all] MongoDB Query:', JSON.stringify(query));

    const questsFromDB = await CommunityQuest.find(query)
      .sort({ end_ts: 1 }) 
      .lean<ICommunityQuestFromDB[]>();

    console.log(`[API /quests/all] Found ${questsFromDB.length} quests from DB with query.`);
    
    const processedQuests: IProcessedQuest[] = await Promise.all(
      questsFromDB.map(async (quest: ICommunityQuestFromDB) => {
        let displayStatus = quest.status;
        let startTime, endTime;

        // Robust date parsing
        if (quest.start_ts) startTime = new Date(quest.start_ts);
        if (quest.end_ts) endTime = new Date(quest.end_ts);

        console.log(`[API /quests/all] Processing Quest ID: ${quest._id}, DB Status: '${quest.status}', Start: ${startTime?.toISOString()}, End: ${endTime?.toISOString()}`);

        // Status override logic - apply if no specific status was requested OR if 'active_or_scheduled_by_date' was the intent
        if ((!statusParam || statusParam === 'active_or_scheduled_by_date') && startTime && endTime) {
            if (quest.status === 'scheduled' && startTime <= now && endTime >= now) {
                displayStatus = 'active';
                console.log(`[API /quests/all]   Overriding status to 'active' for quest ID ${quest._id}.`);
            } else if (endTime < now && quest.status !== 'expired' && quest.status !== 'succeeded' && quest.status !== 'failed') {
                // Potentially mark as expired if end_ts is past and status isn't a final one
                // displayStatus = 'expired'; 
                // console.log(`[API /quests/all]   Marking status as 'expired' for quest ID ${quest._id} as end_ts is past.`);
            }
        } else {
            console.log(`[API /quests/all]   Skipping status override for quest ID ${quest._id}. statusParam: '${statusParam}', hasDates: ${!!(startTime && endTime)}`);
        }

        let progressData = null;
        try {
            const questProgressKey = `${redisConfig.defaultQuestProgressKeyPrefix}${quest._id.toString()}`;
            progressData = await redisService.get(questProgressKey);
        } catch (redisError) {
            console.warn(`[API /quests/all] Redis error for quest ${quest._id.toString()}:`, redisError);
        }
        
        let derivedRewardDesc = quest.reward_description;
        let derivedRewardPoints = quest.reward_points;
        if (quest.rewards && quest.rewards.length > 0) {
            const pointsReward = quest.rewards.find(r => r.type === 'points');
            if (pointsReward && typeof pointsReward.value === 'number') derivedRewardPoints = pointsReward.value;
            if (!derivedRewardDesc) {
                derivedRewardDesc = quest.rewards.map(r => r.description || `${r.value} ${r.type}`).join(', ');
            }
        }

        return {
          _id: quest._id.toString(),
          id: quest._id.toString(),
          title: quest.title,
          description: quest.description,
          status: displayStatus,
          goal_target: quest.goal_target,
          progress: progressData ? progressData.current : (quest.progress || 0),
          goal_units: quest.goal_units,
          reward_description: derivedRewardDesc,
          reward_points: derivedRewardPoints,  
          start_ts: startTime ? startTime.toISOString() : undefined,
          end_ts: endTime ? endTime.toISOString() : undefined,
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