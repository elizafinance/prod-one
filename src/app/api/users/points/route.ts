import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';

// Placeholder for your database connection and logic
// import { connectToDatabase, User } from '@/lib/mongodb'; // Example

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('address');

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const userCollection = db.collection<UserDocument>('users'); // Assuming your collection is named 'users'
    
    const user = await userCollection.findOne({ walletAddress });

    if (user) {
      return NextResponse.json({ points: user.points || 0 });
    } else {
      // If user not found, they have 0 points. Optionally, create them here.
      // For now, just returning 0 points for a non-existent user in the points context.
      return NextResponse.json({ points: 0 }); 
    }
  } catch (error) {
    console.error("Error fetching points:", error);
    return NextResponse.json({ error: 'Failed to fetch points' }, { status: 500 });
  }
} 