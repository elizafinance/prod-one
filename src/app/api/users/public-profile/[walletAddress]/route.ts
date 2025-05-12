import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';

interface PublicProfileData {
  maskedWalletAddress: string;
  xUsername?: string;
  points: number;
  highestAirdropTierLabel?: string;
  referralsMadeCount?: number;
  // Add any other public-safe fields you want to display
}

function maskWalletAddress(address: string): string {
  if (address.length < 10) return address; // Avoid errors on very short strings
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

export async function GET(
  request: Request,
  { params }: { params: { walletAddress: string } }
) {
  const walletAddress = params.walletAddress;

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address parameter is required' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');

    const user = await usersCollection.findOne({ walletAddress });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const publicData: PublicProfileData = {
      maskedWalletAddress: maskWalletAddress(user.walletAddress || walletAddress), // Use original if from DB, else the param
      xUsername: user.xUsername,
      points: user.points || 0,
      highestAirdropTierLabel: user.highestAirdropTierLabel,
      referralsMadeCount: user.referralsMadeCount || 0,
    };

    return NextResponse.json(publicData);

  } catch (error) {
    console.error("Error fetching public user profile:", error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
} 