import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/authSession';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

interface SetRiskPreferenceRequest {
  riskTolerance: number; // 1..5
}

export async function PATCH(req: NextRequest) {
  const authUser = getUserFromRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: SetRiskPreferenceRequest;
  try {
    body = (await req.json()) as SetRiskPreferenceRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { riskTolerance } = body;
  if (typeof riskTolerance !== 'number' || riskTolerance < 1 || riskTolerance > 5) {
    return NextResponse.json({ error: 'riskTolerance must be integer 1-5' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const users = db.collection<UserDocument>('users');
    const userId = new ObjectId(authUser.dbId);

    const updateRes = await users.updateOne(
      { _id: userId },
      {
        $set: {
          'agentRiskTolerance': riskTolerance,
          updatedAt: new Date(),
        },
        $addToSet: { completedActions: 'set_risk_tolerance' },
      }
    );

    if (updateRes.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, riskTolerance });
  } catch (err: any) {
    console.error('[Risk API] Error updating risk tolerance', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Allow POST as alias
export const POST = PATCH; 