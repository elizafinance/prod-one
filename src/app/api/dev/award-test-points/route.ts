import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { getPointsService, AwardPointsOptions } from '@/services/points.service'; // Adjust path if necessary
import { connectToDatabase } from '@/lib/mongodb'; // Needed by PointsService if it doesn't handle its own connection fully

interface AwardPointsRequestBody {
  amount?: number;
}

const DEFAULT_TEST_POINTS_AWARD = 100000;

export async function POST(request: NextRequest) {
  // IMPORTANT: Restrict this endpoint to development environment only
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'This endpoint is for development use only.' }, { status: 403 });
  }

  const session = await getServerSession(authOptions) as any;

  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'User not authenticated or wallet not linked' }, { status: 401 });
  }
  const currentUserWalletAddress = session.user.walletAddress;
  const adminUserIdForLog = session.user.dbId || session.user.walletAddress; // For metadata in points service

  try {
    const body: AwardPointsRequestBody = await request.json().catch(() => ({})); // Default to empty object if no body
    const amountToAward = body.amount || DEFAULT_TEST_POINTS_AWARD;

    if (typeof amountToAward !== 'number' || amountToAward <= 0) {
      return NextResponse.json({ error: 'Invalid amount. Must be a positive number.' }, { status: 400 });
    }

    // Ensure DB connection for PointsService if it requires it explicitly or for logging
    // await connectToDatabase(); // PointsService might handle its own connection through getPointsService
    
    const pointsService = await getPointsService();
    const awardOptions: AwardPointsOptions = {
      reason: 'dev:test_points_award',
      metadata: { 
        adminRequestingDevAward: adminUserIdForLog,
        awardedAmount: amountToAward 
      },
      actionType: 'admin_dev_points_award' // A distinct action type for tracking
    };

    const updatedUser = await pointsService.addPoints(currentUserWalletAddress, amountToAward, awardOptions);

    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to award points. User not found or PointsService error.' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: `Successfully awarded ${amountToAward} test points to ${currentUserWalletAddress}. New balance: ${updatedUser.points}`,
      newPointsBalance: updatedUser.points 
    });

  } catch (error: any) {
    console.error('[API AwardTestPoints POST] Error:', error);
    if (error instanceof SyntaxError) { // From request.json() if body is malformed
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to award test points', details: error.message }, { status: 500 });
  }
} 