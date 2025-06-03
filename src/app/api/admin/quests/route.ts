import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb'; // Retained for potential direct driver use (caching URI validation)
import { ensureMongooseConnected } from '@/lib/mongooseConnect';
import CommunityQuestModel from '@/models/communityQuest.model'; // Renamed for clarity in previous steps
import { getServerSession } from "next-auth/next"; // For auth (actual options to be used)
import { authOptions } from "@/lib/auth"; // Assuming your authOptions are here
import { User } from '@/models/User';
import { Notification } from '@/models/Notification';
import { createNotification } from '@/lib/notificationUtils'; // <<<< IMPORT STANDARDIZED UTILITY
import { connectToDatabase as connectToNativeDb } from '@/lib/mongodb'; // For passing native Db to createNotification

// Interface for POST request body (adjust as needed based on CommunityQuest schema)
interface CreateQuestRequestBody {
  title: string;
  description_md: string;
  goal_type: 'total_referrals' | 'users_at_tier' | 'aggregate_spend' | 'total_squad_points' | 'squad_meetup'; // Included total_squad_points
  goal_target: number;
  goal_target_metadata?: {
    tier_name?: string;
    currency?: string;
    proximity_meters?: number;    // For squad_meetup
    time_window_minutes?: number; // For squad_meetup
  };
  reward_type: 'points' | 'nft' | 'points+nft';
  reward_points?: number;
  reward_nft_id?: string;
  start_ts: string; // ISO Date string
  end_ts: string;   // ISO Date string
  scope: 'community' | 'squad'; // Added scope to the request body interface
  // created_by will be taken from session or a default admin identifier
}

// GET - List all quests with filtering and sorting
export async function GET(request: NextRequest) {
  const session:any = await getServerSession(authOptions);
  // NOTE: Assumes session.user.role is correctly typed via next-auth.d.ts
  if (!session?.user?.role || session.user.role !== 'admin') { 
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const goalTypeFilter = searchParams.get('goal_type');
  const sortBy = searchParams.get('sortBy') || 'created_ts'; // Default sort
  const order = searchParams.get('order') === 'asc' ? 1 : -1; // Default desc

  const query: any = {};
  if (statusFilter) query.status = statusFilter;
  if (goalTypeFilter) query.goal_type = goalTypeFilter;

  const sortOptions: any = {};
  sortOptions[sortBy] = order;

  // Pagination (optional, but good for admin tables with many items)
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '25', 10); // Default 25 items per page for admin
  const skip = (page - 1) * limit;

  try {
    await ensureMongooseConnected();
    
    const totalQuests = await CommunityQuestModel.countDocuments(query);
    const totalPages = Math.ceil(totalQuests / limit);

    const quests = await CommunityQuestModel.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .lean();
      
    return NextResponse.json({
        quests,
        currentPage: page,
        totalPages,
        totalQuests
    });
  } catch (error) {
    console.error('[Admin Quests GET] Error fetching quests:', error);
    return NextResponse.json({ error: 'Failed to fetch quests' }, { status: 500 });
  }
}

// POST - Create a new quest
export async function POST(request: NextRequest) {
  const session:any = await getServerSession(authOptions);
  // NOTE: Assumes session.user.role, walletAddress, id are correctly typed via next-auth.d.ts
  if (!session?.user?.role || session.user.role !== 'admin') { 
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }
  const adminIdentifier = session.user.walletAddress || session.user.id || 'ADMIN_USER';
  const adminUsername = session.user.xUsername || session.user.name || adminIdentifier;

  try {
    const body: CreateQuestRequestBody = await request.json();

    // Basic validation
    if (!body.title || !body.description_md || !body.goal_type || !body.goal_target || !body.reward_type || !body.start_ts || !body.end_ts) {
      return NextResponse.json({ error: 'Missing required fields for quest creation' }, { status: 400 });
    }
    if ((body.reward_type === 'points' || body.reward_type === 'points+nft') && (typeof body.reward_points !== 'number' || body.reward_points <= 0)) {
      return NextResponse.json({ error: 'Valid reward_points required for points reward type' }, { status: 400 });
    }
    if ((body.reward_type === 'nft' || body.reward_type === 'points+nft') && !body.reward_nft_id) {
      return NextResponse.json({ error: 'reward_nft_id required for NFT reward type' }, { status: 400 });
    }
    if (new Date(body.end_ts) <= new Date(body.start_ts)) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    }

    await ensureMongooseConnected();
    const { db: nativeDb } = await connectToNativeDb(); // Get native Db instance for createNotification

    const newQuestData: any = {
      title: body.title,
      description: body.description_md,
      goal_type: body.goal_type,
      goal_target: body.goal_target,
      scope: body.scope,
      start_ts: new Date(body.start_ts),
      end_ts: new Date(body.end_ts),
      status: 'scheduled',
      created_by: adminIdentifier,
      rewards: [] // Initialize rewards array
    };

    // Construct rewards array based on body input
    const rewardsArray = [];
    if (body.reward_type === 'points' && typeof body.reward_points === 'number' && body.reward_points > 0) {
        rewardsArray.push({ type: 'points', value: body.reward_points, description: `${body.reward_points} points` });
    }
    if (body.reward_type === 'nft' && body.reward_nft_id) {
        rewardsArray.push({ type: 'nft', value: body.reward_nft_id, description: `NFT: ${body.reward_nft_id}` });
    }
    if (body.reward_type === 'points+nft') {
        if (typeof body.reward_points === 'number' && body.reward_points > 0) {
            rewardsArray.push({ type: 'points', value: body.reward_points, description: `${body.reward_points} points` });
        }
        if (body.reward_nft_id) {
            rewardsArray.push({ type: 'nft', value: body.reward_nft_id, description: `NFT: ${body.reward_nft_id}` });
        }
    }
    if (rewardsArray.length > 0) {
        newQuestData.rewards = rewardsArray;
    } else {
        // If no valid rewards were constructed based on input, remove the empty rewards array 
        // or ensure your schema allows an empty rewards array if that's intended.
        // Mongoose typically allows empty arrays if not explicitly forbidden.
        // Let's keep it as an empty array as the schema doesn't require it to be non-empty.
    }

    // Conditionally add goal_target_metadata based on goal_type
    if (body.goal_type === 'users_at_tier' && body.goal_target_metadata?.tier_name) {
        newQuestData.goal_target_metadata = { tier_name: body.goal_target_metadata.tier_name };
    } else if (body.goal_type === 'aggregate_spend' && body.goal_target_metadata?.currency) {
        newQuestData.goal_target_metadata = { currency: body.goal_target_metadata.currency };
    } else if (body.goal_type === 'squad_meetup') {
        const proxMeters = body.goal_target_metadata?.proximity_meters;
        const timeWindow = body.goal_target_metadata?.time_window_minutes;
        if (
            typeof proxMeters !== 'number' || proxMeters <= 0 ||
            typeof timeWindow !== 'number' || timeWindow <= 0
        ) {
            return NextResponse.json({ error: 'Valid, positive Proximity (meters) and Time Window (minutes) are required for Squad Meetup quests.' }, { status: 400 });
        }
        newQuestData.goal_target_metadata = {
            proximity_meters: proxMeters,
            time_window_minutes: timeWindow
        };
        // Ensure goal_target (min members) is also positive for squad_meetup
        if (typeof body.goal_target !== 'number' || body.goal_target <= 0) {
            return NextResponse.json({ error: 'Valid, positive Goal Target (min members) is required for Squad Meetup quests.' }, { status: 400 });
        }
    } else {
        // If not one of these types, or metadata not provided, ensure it's not set or is set to null
        // The model has `default: null` for goal_target_metadata, so not setting it is fine.
        delete newQuestData.goal_target_metadata; 
    }
    const newQuest = new CommunityQuestModel(newQuestData);

    await newQuest.save();

    // Notify squad members about new squad-scope quest becoming available
    if (newQuest.scope === 'squad') {
      try {
        // User model is Mongoose, find returns Mongoose documents
        const squadUsers = await User.find({ squadId: { $exists: true, $ne: null } }).select('_id walletAddress squadId xUsername').lean();
        
        if (squadUsers.length > 0) {
          const notificationTitle = `New Squad Quest: ${newQuest.title}`;
          const ctaUrl = `/quests/${newQuest._id.toString()}`;
          let notificationsSentCount = 0;

          for (const user of squadUsers) {
            if (user.walletAddress) { // Ensure user has a wallet address to receive notification
              const notificationMessage = `A new quest "${newQuest.title}" is now available for your squad!`;
              await createNotification(
                nativeDb, // Use the native Db instance
                user.walletAddress, 
                'new_squad_quest', // <<<< CHANGE TYPE TO BE MORE SPECIFIC
                notificationTitle,
                notificationMessage,
                ctaUrl,
                newQuest._id.toString(),    // relatedQuestId
                newQuest.title,             // relatedQuestTitle
                user.squadId,               // relatedSquadId
                undefined,                  // relatedSquadName (can fetch squad name if needed, or omit)
                adminIdentifier,            // relatedUserId (admin who created the quest)
                adminUsername               // relatedUserName (admin's name)
              );
              notificationsSentCount++;
            }
          }
          console.log(`[Admin Quests POST] Attempted to send ${notificationsSentCount} notifications for new squad quest '${newQuest.title}'.`);
        }
      } catch (notifyErr) {
        console.error('[Admin Quests POST] Error creating notifications for squad quest:', notifyErr);
        // Non-critical error, don't fail the quest creation itself
      }
    }

    return NextResponse.json(newQuest, { status: 201 });
  } catch (error: any) {
    console.error('[Admin Quests POST] Error creating quest:', error);
    if (error.name === 'ValidationError') {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    if (error instanceof SyntaxError) { // For invalid JSON
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create quest' }, { status: 500 });
  }
} 