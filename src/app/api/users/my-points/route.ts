import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { getServerSession, Session } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions) as Session | null;

  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated or wallet address not found in session' }, { status: 401 });
  }

  const userWalletAddress = session.user.walletAddress;

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');

    const user = await usersCollection.findOne(
      { walletAddress: userWalletAddress },
      { projection: { points: 1, _id: 0 } } // Only fetch points
    );

    if (!user) {
      // This case might happen if the user document hasn't been created yet, 
      // or walletAddress in session is stale (very unlikely with JWT strategy)
      return NextResponse.json({ points: 0 }); // Default to 0 points if user not found
    }

    return NextResponse.json({ points: user.points || 0 });

  } catch (error) {
    console.error("Error fetching user points:", error);
    return NextResponse.json({ error: 'Failed to fetch user points' }, { status: 500 });
  }
} 