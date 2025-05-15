import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import CommunityQuestModel from '@/models/communityQuest.model'; // Renamed for clarity in previous steps
import { getServerSession } from "next-auth/next"; // For auth (actual options to be used)
import { authOptions } from "@/lib/auth"; // Assuming your authOptions are here

// Interface for POST request body (adjust as needed based on CommunityQuest schema)
interface CreateQuestRequestBody {
  title: string;
  description_md: string;
  goal_type: 'total_referrals' | 'users_at_tier' | 'aggregate_spend' | 'squad_meetup'; // Added squad_meetup
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
  // created_by will be taken from session or a default admin identifier
}

// GET - List all quests with filtering and sorting
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
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
    await connectToDatabase();
    
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
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  // NOTE: Assumes session.user.role, walletAddress, id are correctly typed via next-auth.d.ts
  if (!session?.user?.role || session.user.role !== 'admin') { 
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }
  const adminIdentifier = session.user.walletAddress || session.user.id || 'ADMIN_USER';

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

    await connectToDatabase();

    const newQuestData: any = {
      ...body,
      start_ts: new Date(body.start_ts),
      end_ts: new Date(body.end_ts),
      status: 'scheduled', // Default status for new quests
      created_by: adminIdentifier, 
      // created_ts and updated_ts will be handled by Mongoose timestamps
    };
    // Conditionally add goal_target_metadata based on goal_type
    if (body.goal_type === 'users_at_tier' && body.goal_target_metadata?.tier_name) {
        newQuestData.goal_target_metadata = { tier_name: body.goal_target_metadata.tier_name };
    } else if (body.goal_type === 'aggregate_spend' && body.goal_target_metadata?.currency) {
        newQuestData.goal_target_metadata = { currency: body.goal_target_metadata.currency };
    } else if (body.goal_type === 'squad_meetup') {
        if (typeof body.goal_target_metadata?.proximity_meters !== 'number' || typeof body.goal_target_metadata?.time_window_minutes !== 'number') {
            return NextResponse.json({ error: 'Proximity (meters) and Time Window (minutes) are required for Squad Meetup quests.' }, { status: 400 });
        }
        newQuestData.goal_target_metadata = {
            proximity_meters: body.goal_target_metadata.proximity_meters,
            time_window_minutes: body.goal_target_metadata.time_window_minutes
        };
    } else {
        // If not one of these types, or metadata not provided, ensure it's not set or is set to null
        // The model has `default: null` for goal_target_metadata, so not setting it is fine.
        delete newQuestData.goal_target_metadata; 
    }
    const newQuest = new CommunityQuestModel(newQuestData);

    await newQuest.save();

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