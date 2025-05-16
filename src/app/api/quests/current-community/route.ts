import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ensureMongooseConnected } from '@/lib/mongooseConnect';
import CommunityQuest from '@/models/communityQuest.model.js';
import { redisService } from '@/services/redis.service';
import { redisConfig } from '@/config/redis.config';

// API: /api/quests/current-community
// Returns the "current" community-scoped quest, prioritising:
//  1. Any quest already marked as `active`
//  2. Else a quest whose scheduled window is currently open (start<=now<=end)
//  3. Else the most recently created quest (any status)
export async function GET() {
  try {
    // Ensure DB connections (Mongoose is used everywhere else, keep it consistent)
    await connectToDatabase();
    await ensureMongooseConnected();

    // Always have Redis ready in case we need progress
    await redisService.connect();

    const now = new Date();

    // 1) Explicitly active quest, soonest ending first
    let questDoc: any = await CommunityQuest.findOne({ scope: 'community', status: 'active' })
      .sort({ end_ts: 1 })
      .lean();

    // 2) If none, scheduled quest whose window is currently open
    if (!questDoc) {
      questDoc = (await CommunityQuest.findOne({
        scope: 'community',
        status: { $in: ['active', 'scheduled'] },
        start_ts: { $lte: now },
        end_ts: { $gte: now },
      })
        .sort({ end_ts: 1 })
        .lean()) as any;
    }

    // 3) Fallback to latest quest (any status) so UI has something rather than 404
    if (!questDoc) {
      questDoc = (await CommunityQuest.findOne({ scope: 'community' })
        .sort({ created_ts: -1 })
        .lean()) as any;
    }

    if (!questDoc) {
      return NextResponse.json({ error: 'No quests found' }, { status: 404 });
    }

    // Grab progress from Redis if available
    let progress = (questDoc as any).progress || 0;
    try {
      const progressKey = `${redisConfig.defaultQuestProgressKeyPrefix}${questDoc._id.toString()}`;
      const redisData = await redisService.get(progressKey);
      if (redisData && typeof redisData.current === 'number') {
        progress = redisData.current;
      }
    } catch (e) {
      console.warn('[API /quests/current-community] Redis error', e);
    }

    const result = {
      id: questDoc._id.toString(),
      _id: questDoc._id.toString(),
      title: questDoc.title,
      description: questDoc.description,
      reward:
        // Prefer explicit reward_description, else derive from rewards array
        (questDoc as any).reward_description ||
        questDoc.rewards?.[0]?.description ||
        questDoc.rewards?.[0]?.value ||
        '',
      progress,
      target: (questDoc as any).goal_target ?? 0,
      status: questDoc.status,
      start_ts: (questDoc as any).start_ts,
      end_ts: (questDoc as any).end_ts,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API /quests/current-community] Failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current community quest' },
      { status: 500 }
    );
  }
} 