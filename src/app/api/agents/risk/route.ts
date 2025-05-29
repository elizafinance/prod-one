import { NextRequest, NextResponse } from 'next/server';
// import { getUserFromRequest } from '@/lib/authSession'; // Replaced with getHybridUser
import { getHybridUser, HybridAuthResult } from '@/lib/hybridAuth'; // Import new helper
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { cookies } from 'next/headers';

interface SetRiskPreferenceRequest {
  riskTolerance: number; // 1..5
}

export async function PATCH(req: NextRequest) {
  const cookieStore = cookies();
  const tokenFromCookie = cookieStore.get('auth')?.value;
  const allCookies = req.cookies.getAll();
  
  console.log('[Risk API] входящий запрос (incoming request):', { 
    url: req.url,
    method: req.method,
    headers: Object.fromEntries(req.headers.entries()),
    cookiesFromNextHeaders: Object.fromEntries(cookieStore.getAll().map(c => [c.name, c.value])),
    cookiesFromReqObject: Object.fromEntries(allCookies.map(c => [c.name, c.value])),
    specificAuthCookieValue: tokenFromCookie ? `Present (length: ${tokenFromCookie.length})` : 'MISSING_OR_UNDEFINED' 
  });

  const hybridAuthSession: HybridAuthResult = await getHybridUser(req);

  if (!hybridAuthSession || !hybridAuthSession.user) {
    console.error('[Risk API] Authentication failed: getHybridUser returned null or no user. Specific auth cookie was:', tokenFromCookie ? "Present" : "Missing", "Auth header was:", req.headers.get('authorization') ? "Present" : "Missing");
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Use the user object from the hybrid session
  const authUser = hybridAuthSession.user;
  console.log(`[Risk API] Authenticated via ${hybridAuthSession.source} by user: ${authUser.dbId}`);

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

    // Ensure the user document has the agentRiskTolerance field if it doesn't exist
    // This is just to satisfy TypeScript if UserDocument was recently updated.
    // The $set operator will create the field if it's not present.
    const updateResult = await users.updateOne(
      { _id: userId },
      {
        $set: {
          agentRiskTolerance: riskTolerance, // Ensure this field exists on UserDocument or use type assertion
          updatedAt: new Date(),
          // If linking Crossmint info on this action is desired (though getHybridUser might already do it)
          // crossmintUserId: hybridAuthSession.type === 'crossmint' ? hybridAuthSession.crossmintUserId : undefined,
          // crossmintWalletAddress: hybridAuthSession.type === 'crossmint' ? authUser.walletAddress : undefined,
          // crossmintWalletChain: hybridAuthSession.type === 'crossmint' ? authUser.chain : undefined,
        },
        $addToSet: { completedActions: 'set_risk_tolerance' },
      }
    );

    if (updateResult.matchedCount === 0) {
      console.error(`[Risk API] User not found in DB with dbId: ${authUser.dbId}`);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log(`[Risk API] Successfully updated risk tolerance for user ${authUser.dbId} to ${riskTolerance}`);
    return NextResponse.json({ success: true, riskTolerance });
  } catch (err: any) {
    console.error('[Risk API] Error updating risk tolerance', err);
    return NextResponse.json({ error: 'Server error while updating risk tolerance' }, { status: 500 });
  }
}

// Allow POST as alias
export const POST = PATCH; 