import { NextResponse } from 'next/server';
import { connectToDatabase, SquadInvitationDocument } from '@/lib/mongodb';
import { PublicKey } from '@solana/web3.js';

// Protect with CRON_SECRET header (same pattern as other cron endpoints)
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  const legacyHeader = request.headers.get('x-cron-secret') || request.headers.get('X-Cron-Secret');
  const secret = process.env.CRON_SECRET;
  if (!secret || (token !== secret && legacyHeader !== secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { db } = await connectToDatabase();
    const invitations = db.collection<SquadInvitationDocument>('squadInvitations');

    // cursor for pending invites
    const pendingCursor = invitations.find({ status: 'pending' }, { projection: { invitationId: 1, invitedUserWalletAddress: 1 } });

    const bulk = invitations.initializeUnorderedBulkOp();
    let checked = 0;
    let invalid = 0;

    while (await pendingCursor.hasNext()) {
      const inv = await pendingCursor.next();
      if (!inv) break;
      checked += 1;
      const addr = inv.invitedUserWalletAddress;
      let valid = false;
      try {
        // Will throw if not base58 / wrong length etc.
        new PublicKey(addr);
        valid = true;
      } catch (_) {
        valid = false;
      }
      if (!valid) {
        invalid += 1;
        bulk.find({ invitationId: inv.invitationId }).updateOne({ $set: { status: 'invalid_address', updatedAt: new Date() } });
      }
    }

    if (invalid > 0) {
      await bulk.execute();
    }

    return NextResponse.json({ checked, invalid }, { status: 200 });
  } catch (err) {
    console.error('[Cron] cleanup-invalid-invites error:', err);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
} 