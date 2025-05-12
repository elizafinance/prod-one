import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('address');

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    
    const user = await usersCollection.findOne({ walletAddress });

    if (user) {
      return NextResponse.json({ completedActions: user.completedActions || [] });
    } else {
      // If user not found, they have no completed actions. 
      // This is expected if they haven't interacted yet.
      return NextResponse.json({ completedActions: [] }); 
    }
  } catch (error) {
    console.error("Error fetching completed actions:", error);
    return NextResponse.json({ error: 'Failed to fetch completed actions' }, { status: 500 });
  }
} 