import { NextResponse } from 'next/server';
import { withAuth } from '@/middleware/authGuard';
import { functionMonitor } from '@/utils/functionMonitoring';

const baseHandler = withAuth(async (request: Request, session) => {
  try {
    // Verify user is admin
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    const url = new URL(request.url);
    const minutes = parseInt(url.searchParams.get('minutes') || '60');
    const thresholdMs = parseInt(url.searchParams.get('threshold') || '3000');

    const summary = functionMonitor.getMetricsSummary(minutes);
    const expensiveFunctions = functionMonitor.getExpensiveFunctions(thresholdMs);

    // Calculate total estimated monthly cost
    const totalEstimatedMonthlyCost = expensiveFunctions.reduce(
      (total, fn) => total + fn.estimatedMonthlyCost,
      0
    );

    return NextResponse.json({
      timeframe: `Last ${minutes} minutes`,
      threshold: `Functions averaging > ${thresholdMs}ms`,
      totalEstimatedMonthlyCost: totalEstimatedMonthlyCost.toFixed(2),
      expensiveFunctions,
      allFunctions: summary,
    });

  } catch (error) {
    console.error('Error fetching function metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
});

export const GET = baseHandler;