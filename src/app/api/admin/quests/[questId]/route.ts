import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import CommunityQuestModel from '@/models/communityQuest.model';
import mongoose, { Types } from 'mongoose'; // Import mongoose and Types
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// Simplified Lean Quest for date checking in PUT
interface LeanQuestForDateCheck {
    _id: Types.ObjectId;
    start_ts: Date;
    end_ts: Date;
}

// Interface for PUT request body (similar to POST, but all fields optional for partial updates)
interface UpdateQuestRequestBody {
  title?: string;
  description_md?: string;
  goal_type?: 'total_referrals' | 'users_at_tier' | 'aggregate_spend' | 'squad_meetup';
  goal_target?: number;
  goal_target_metadata?: {
    tier_name?: string;
    currency?: string;
    proximity_meters?: number;
    time_window_minutes?: number;
  };
  reward_type?: 'points' | 'nft' | 'points+nft';
  reward_points?: number;
  reward_nft_id?: string;
  start_ts?: string; // ISO Date string
  end_ts?: string;   // ISO Date string
  status?: 'scheduled' | 'active' | 'succeeded' | 'failed' | 'expired'; // Allow status updates
  scope?: 'community' | 'squad'; // Added scope
}

interface RouteContext {
  params: {
    questId: string;
  }
}

// GET - Get a single quest by ID
export async function GET(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  const { questId } = params;
  if (!mongoose.Types.ObjectId.isValid(questId)) {
    return NextResponse.json({ error: 'Invalid quest ID format' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const quest = await CommunityQuestModel.findById(questId).lean();
    if (!quest) {
      return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    }
    return NextResponse.json(quest);
  } catch (error) {
    console.error(`[Admin Quests GET /${questId}] Error fetching quest:`, error);
    return NextResponse.json({ error: 'Failed to fetch quest' }, { status: 500 });
  }
}

// PUT - Update a quest by ID
export async function PUT(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  const { questId } = params;
  if (!mongoose.Types.ObjectId.isValid(questId)) {
    return NextResponse.json({ error: 'Invalid quest ID format' }, { status: 400 });
  }

  try {
    const body: UpdateQuestRequestBody = await request.json();
    const updatePayload: any = { ...body }; // Start with all fields from body

    // Date validations and conversions
    if (body.start_ts && body.end_ts && new Date(body.end_ts) <= new Date(body.start_ts)) {
      return NextResponse.json({ error: 'End date must be after start date' }, { status: 400 });
    } else if (body.start_ts && !body.end_ts) {
        const existingQuest = await CommunityQuestModel.findById(questId).select('end_ts').lean<LeanQuestForDateCheck>();
        if (existingQuest && new Date(existingQuest.end_ts) <= new Date(body.start_ts)) {
            return NextResponse.json({ error: 'End date must be after start date (existing end_ts)' }, { status: 400 });
        }
    } else if (!body.start_ts && body.end_ts) {
        const existingQuest = await CommunityQuestModel.findById(questId).select('start_ts').lean<LeanQuestForDateCheck>();
        if (existingQuest && new Date(body.end_ts) <= new Date(existingQuest.start_ts)) {
            return NextResponse.json({ error: 'End date must be after start date (existing start_ts)' }, { status: 400 });
        }
    }
    
    // Convert date strings to Date objects if they exist
    if (body.start_ts) updatePayload.start_ts = new Date(body.start_ts);
    if (body.end_ts) updatePayload.end_ts = new Date(body.end_ts);

    // Handle goal_target_metadata based on goal_type if goal_type is being updated or is present
    const currentGoalType = body.goal_type; // If goal_type is not in body, we might need to fetch existing quest to know its type
                                         // For simplicity, assume if goal_target_metadata is in body, goal_type is also relevant or present.

    if (currentGoalType) { // Only process metadata if goal_type is part of the update or contextually relevant
        updatePayload.goal_target_metadata = {}; // Reset to ensure no old metadata persists if type changes
        if (currentGoalType === 'users_at_tier') {
            if (body.goal_target_metadata?.tier_name) {
                updatePayload.goal_target_metadata.tier_name = body.goal_target_metadata.tier_name;
            } else if (body.goal_type === 'users_at_tier') { // If goal_type is explicitly set to this, tier_name might be required
                 // Consider adding validation: if goal_type is set/changed to users_at_tier, tier_name is mandatory.
            }
        } else if (currentGoalType === 'aggregate_spend') {
            if (body.goal_target_metadata?.currency) {
                updatePayload.goal_target_metadata.currency = body.goal_target_metadata.currency;
            }
        } else if (currentGoalType === 'squad_meetup') {
            const proxMeters = body.goal_target_metadata?.proximity_meters;
            const timeWindow = body.goal_target_metadata?.time_window_minutes;

            // If the goal_type is being set to squad_meetup or is already squad_meetup,
            // then these fields become mandatory and must be valid.
            let isExistingMeetupQuest = false;
            if (!body.goal_type) { // If goal_type is not in body, check existing quest type
                const existingQuest = await CommunityQuestModel.findById(questId).select('goal_type').lean<{ goal_type: string }>();
                if (existingQuest?.goal_type === 'squad_meetup') {
                    isExistingMeetupQuest = true;
                }
            }

            if (body.goal_type === 'squad_meetup' || isExistingMeetupQuest) {
                if (typeof proxMeters !== 'number' || proxMeters <= 0 || typeof timeWindow !== 'number' || timeWindow <= 0) {
                    // Check if the values are being provided in this update. If not, and it's an existing meetup quest, this validation might be too strict.
                    // This validation should primarily apply if goal_type is being SET to squad_meetup OR if these specific metadata are in the body to be updated for an existing meetup quest.
                    let shouldValidateFullMetadata = body.goal_type === 'squad_meetup'; // Definitely validate if type is being set
                    if (!shouldValidateFullMetadata && isExistingMeetupQuest && body.goal_target_metadata && (body.goal_target_metadata.hasOwnProperty('proximity_meters') || body.goal_target_metadata.hasOwnProperty('time_window_minutes'))) {
                        // If it's an existing meetup quest and metadata is being partially updated, validate the parts being sent.
                        if (body.goal_target_metadata.hasOwnProperty('proximity_meters') && (typeof proxMeters !== 'number' || proxMeters <= 0)) {
                             return NextResponse.json({ error: 'Valid Proximity (meters) is required for Squad Meetup quest metadata update.' }, { status: 400 });
                        }
                        if (body.goal_target_metadata.hasOwnProperty('time_window_minutes') && (typeof timeWindow !== 'number' || timeWindow <= 0)) {
                            return NextResponse.json({ error: 'Valid Time Window (minutes) is required for Squad Meetup quest metadata update.' }, { status: 400 });
                        }
                    } else if (shouldValidateFullMetadata && (typeof proxMeters !== 'number' || proxMeters <= 0 || typeof timeWindow !== 'number' || timeWindow <= 0)) {
                        // If type is being set to squad_meetup, both are strictly required and must be valid.
                        return NextResponse.json({ error: 'For Squad Meetup quests, valid Proximity (meters) and Time Window (minutes) are required in metadata.' }, { status: 400 });
                    }
                }
            }
            
            // Assign if valid numbers are provided (even if goal_type isn't changing but these values are in body)
            if (typeof proxMeters === 'number') {
                if (proxMeters > 0) updatePayload.goal_target_metadata.proximity_meters = proxMeters;
                else if (body.goal_type === 'squad_meetup') return NextResponse.json({ error: 'Proximity must be positive.'}, {status: 400}); 
            }
            if (typeof timeWindow === 'number') {
                if (timeWindow > 0) updatePayload.goal_target_metadata.time_window_minutes = timeWindow;
                else if (body.goal_type === 'squad_meetup') return NextResponse.json({ error: 'Time window must be positive.'}, {status: 400});
            }
            
            // Final check if type is squad_meetup but metadata ended up empty
            if (body.goal_type === 'squad_meetup' && Object.keys(updatePayload.goal_target_metadata || {}).length === 0) {
                 return NextResponse.json({ error: 'Proximity and Time Window metadata are required for Squad Meetup type if not already set.' }, { status: 400 });
            }

        } 
        
        if (Object.keys(updatePayload.goal_target_metadata).length === 0) {
            delete updatePayload.goal_target_metadata; 
        }
    } else if (body.goal_target_metadata && Object.keys(body.goal_target_metadata).length > 0) {
        // If goal_target_metadata is provided WITHOUT a goal_type in the update, this is ambiguous.
        // It's safer to require goal_type if goal_target_metadata is being substantially changed.
        // For now, we'll pass it through if goal_type is not changing.
        updatePayload.goal_target_metadata = body.goal_target_metadata;
    }

    // Ensure fields like reward_points are numbers if present
    if (body.reward_points !== undefined) updatePayload.reward_points = Number(body.reward_points);
    if (body.goal_target !== undefined) updatePayload.goal_target = Number(body.goal_target);

    updatePayload.updated_ts = new Date();

    await connectToDatabase();
    const updatedQuest = await CommunityQuestModel.findByIdAndUpdate(
      questId,
      { $set: updatePayload }, 
      { new: true, runValidators: true }
    ).lean();

    if (!updatedQuest) {
      return NextResponse.json({ error: 'Quest not found or no changes made' }, { status: 404 });
    }
    return NextResponse.json(updatedQuest);
  } catch (error: any) {
    console.error(`[Admin Quests PUT /${questId}] Error updating quest:`, error);
    if (error.name === 'ValidationError') {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update quest' }, { status: 500 });
  }
}

// DELETE - Delete a quest by ID (or mark as inactive/archived)
export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  const { questId } = params;
  if (!mongoose.Types.ObjectId.isValid(questId)) {
    return NextResponse.json({ error: 'Invalid quest ID format' }, { status: 400 });
  }

  try {
    await connectToDatabase();
    // Option 1: Actual Deletion (use with caution)
    // const result = await CommunityQuestModel.deleteOne({ _id: questId });
    // if (result.deletedCount === 0) {
    //   return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    // }
    // return NextResponse.json({ message: 'Quest deleted successfully' });

    // Option 2: Mark as 'failed' or 'archived' (safer)
    const updatedQuest = await CommunityQuestModel.findByIdAndUpdate(
      questId,
      { $set: { status: 'failed', notes: 'Manually archived/cancelled by admin.', updated_ts: new Date() } }, // Or a new status like 'archived'
      { new: true }
    ).lean();

    if (!updatedQuest) {
      return NextResponse.json({ error: 'Quest not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Quest marked as failed/archived', quest: updatedQuest });

  } catch (error) {
    console.error(`[Admin Quests DELETE /${questId}] Error deleting/archiving quest:`, error);
    return NextResponse.json({ error: 'Failed to delete/archive quest' }, { status: 500 });
  }
} 