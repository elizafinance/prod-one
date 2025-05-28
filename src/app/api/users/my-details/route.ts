import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';

export async function GET() {
  const session = await getServerSession(authOptions) as any;

  if (!session || !session.user) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');

    // Try by dbId first (preferred), else by walletAddress
    let user: UserDocument | null = null;
    if (session.user.dbId) {
      user = await usersCollection.findOne({ _id: new (await import('mongodb')).ObjectId(session.user.dbId) }, {
        projection: { referralCode: 1, completedActions: 1, xUsername: 1, squadId: 1, points: 1, _id: 0 }
      });
    }
    if (!user && session.user.walletAddress) {
      user = await usersCollection.findOne({ walletAddress: session.user.walletAddress }, {
        projection: { referralCode: 1, completedActions: 1, xUsername: 1, squadId: 1, points: 1, _id: 0 }
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: any) {
    console.error('[API /users/my-details] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 });
  }
} 