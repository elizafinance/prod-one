import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';

const SHARE_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

const handler = withAuth(async (_req, session) => {
  const walletAddress = session.user.walletAddress;
  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress not found in session' }, { status: 400 });
  }
  const { db } = await connectToDatabase();
  const users = db.collection<UserDocument>('users');
  const user = await users.findOne({ walletAddress }, { projection: { [`last_shared_on_x_at`]: 1 } });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const lastShared = (user as any).last_shared_on_x_at ? new Date((user as any).last_shared_on_x_at) : null;
  let nextAvailableAt: Date | null = null;
  if (lastShared) {
    const diff = Date.now() - lastShared.getTime();
    if (diff < SHARE_COOLDOWN_MS) {
      nextAvailableAt = new Date(lastShared.getTime() + SHARE_COOLDOWN_MS);
    }
  }
  return NextResponse.json({ nextAvailableAt });
});

export const GET = handler; 