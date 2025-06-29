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

    // Stream the response instead of loading everything into memory
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send CSV header
          controller.enqueue(encoder.encode('wallet_address,total_estimated_airdrop,current_points,initial_airdrop_amount\n'));

          // Use cursor to stream results
          const cursor = usersCollection
            .find(
              { walletAddress: { $exists: true, $ne: "" } },
              { 
                projection: { 
                  walletAddress: 1, 
                  totalEstimatedAirdrop: 1,
                  points: 1,
                  initialAirdropAmount: 1 
                }
              }
            )
            .batchSize(1000); // Process in batches

          let count = 0;
          const startTime = Date.now();

          for await (const user of cursor) {
            const walletAddress = user.walletAddress || '';
            const totalEstimatedAirdrop = user.totalEstimatedAirdrop || 0;
            const currentPoints = user.points || 0;
            const initialAirdropAmount = user.initialAirdropAmount || 0;
            
            const row = `${walletAddress},${totalEstimatedAirdrop},${currentPoints},${initialAirdropAmount}\n`;
            controller.enqueue(encoder.encode(row));
            
            count++;
            
            // Check if we're taking too long (8 seconds limit with 2s buffer)
            if (Date.now() - startTime > 8000) {
              console.warn(`[Airdrop Export] Timeout approaching, exported ${count} records`);
              controller.enqueue(encoder.encode(`\n# Export truncated due to timeout after ${count} records\n`));
              break;
            }
          }

          console.log(`[Airdrop Export] Successfully exported ${count} records`);
        } catch (error) {
          console.error('[Airdrop Export] Stream error:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      }
    });

    // Return streaming response
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="airdrop_export_${new Date().toISOString().split('T')[0]}.csv"`,
        'Cache-Control': 'no-cache',
      }
    });

  } catch (error) {
    console.error('Error exporting airdrop data:', error);
    return NextResponse.json({ error: 'Failed to export airdrop data' }, { status: 500 });
  }
});

export const GET = baseHandler;