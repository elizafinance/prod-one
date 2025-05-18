import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getPointsService } from '@/services/points.service';
import { z } from 'zod';

const convertAirRequestSchema = z.object({
  tierRequested: z.number().int().min(1, 'Tier ID must be positive'), // Assuming tier IDs are numbers (e.g., 1, 2, 3)
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userWallet = session.user.walletAddress;

  let reqBody;
  try {
    reqBody = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const validation = convertAirRequestSchema.safeParse(reqBody);
  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid input', details: validation.error.flatten() }, { status: 400 });
  }

  const { tierRequested } = validation.data;

  try {
    const pointsService = await getPointsService();
    const result = await pointsService.convertPointsToAirNft(userWallet, tierRequested);

    if (!result.success) {
      return NextResponse.json({ error: result.message || 'Failed to convert AIR points to NFT' }, { status: 400 }); // Or 500 depending on error type
    }

    return NextResponse.json({
      message: result.message,
      txSignature: result.txSignature,
      nftId: result.nftId,
    });

  } catch (error) {
    console.error('[API /api/air/convert] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: 'Failed to process AIR to NFT conversion', details: errorMessage }, { status: 500 });
  }
} 