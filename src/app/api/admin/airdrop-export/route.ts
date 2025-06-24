import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { withAuth } from '@/middleware/authGuard';

const baseHandler = withAuth(async (request: Request, session) => {
  try {
    // Verify user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');

    // Fetch all users with their wallet address and totalEstimatedAirdrop
    const users = await usersCollection
      .find(
        { walletAddress: { $exists: true, $ne: "" } }
      )
      .project({ 
        walletAddress: 1, 
        totalEstimatedAirdrop: 1,
        points: 1,
        initialAirdropAmount: 1 
      })
      .toArray();

    // Build CSV header
    const csvHeader = 'wallet_address,total_estimated_airdrop,current_points,initial_airdrop_amount\n';
    
    // Build CSV rows
    const csvRows = users.map(user => {
      const walletAddress = user.walletAddress || '';
      const totalEstimatedAirdrop = user.totalEstimatedAirdrop || 0;
      const currentPoints = user.points || 0;
      const initialAirdropAmount = user.initialAirdropAmount || 0;
      
      return `${walletAddress},${totalEstimatedAirdrop},${currentPoints},${initialAirdropAmount}`;
    }).join('\n');
    
    const csv = csvHeader + csvRows;

    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="airdrop_export_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error('Error exporting airdrop data:', error);
    return NextResponse.json({ error: 'Failed to export airdrop data' }, { status: 500 });
  }
});

export const GET = baseHandler; 