import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument } from '@/lib/mongodb';

interface PublicProfileSquadInfo {
  squadId: string;
  name: string;
}

interface PublicProfileData {
  maskedWalletAddress: string;
  xUsername?: string;
  xProfileImageUrl?: string;
  points: number;
  highestAirdropTierLabel?: string;
  referralsMadeCount?: number;
  squadInfo?: PublicProfileSquadInfo | null;
  earnedBadgeIds?: string[];
}

function maskWalletAddress(address: string): string {
  if (!address || address.length < 8) return address;
  return `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
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
    const squadsCollection = db.collection<SquadDocument>('squads');

    const user = await usersCollection.findOne({ walletAddress });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let squadInfo: PublicProfileSquadInfo | null = null;
    if (user.squadId) {
      const squad = await squadsCollection.findOne({ squadId: user.squadId });
      if (squad) {
        squadInfo = { squadId: squad.squadId, name: squad.name };
      }
    }

    const publicData: PublicProfileData = {
      maskedWalletAddress: maskWalletAddress(user.walletAddress || walletAddress),
      xUsername: user.xUsername,
      xProfileImageUrl: user.xProfileImageUrl,
      points: user.points || 0,
      highestAirdropTierLabel: user.highestAirdropTierLabel,
      referralsMadeCount: user.referralsMadeCount || 0,
      squadInfo: squadInfo,
      earnedBadgeIds: user.earnedBadgeIds || [],
    };

    return NextResponse.json(publicData);

  } catch (error) {
    console.error("Error fetching public user profile:", error);
    return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
  }
} 