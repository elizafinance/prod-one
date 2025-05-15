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
  goal_type?: 'total_referrals' | 'users_at_tier' | 'aggregate_spend';
  goal_target?: number;
  reward_type?: 'points' | 'nft' | 'points+nft';
  reward_points?: number;
  reward_nft_id?: string;
  start_ts?: string; // ISO Date string
  end_ts?: string;   // ISO Date string
  status?: 'scheduled' | 'active' | 'succeeded' | 'failed' | 'expired'; // Allow status updates
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

    // Basic validation for dates if provided
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
    const updatePayload: any = { ...body };
    if (body.start_ts) updatePayload.start_ts = new Date(body.start_ts);
    if (body.end_ts) updatePayload.end_ts = new Date(body.end_ts);
    updatePayload.updated_ts = new Date(); // Manually set updated_ts as Mongoose default only works on save()

    await connectToDatabase();
    const updatedQuest = await CommunityQuestModel.findByIdAndUpdate(
      questId,
      { $set: updatePayload }, 
      { new: true, runValidators: true } // new: true returns the modified document
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