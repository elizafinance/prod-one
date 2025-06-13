import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { Filter, Document } from 'mongodb';
import { isAdminSession } from '@/lib/adminUtils';

export async function GET(request: NextRequest) {
  const session: any = await getServerSession(authOptions);

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  try {
    const { db } = await connectToDatabase();
    const auditLogsCollection = db.collection('adminAuditLogs');
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const skip = (page - 1) * limit;

    const adminUserIdFilter = searchParams.get('adminUserId');
    const actionFilter = searchParams.get('action');
    const targetEntityTypeFilter = searchParams.get('targetEntityType');
    const targetEntityIdFilter = searchParams.get('targetEntityId');
    const startDateFilter = searchParams.get('startDate');
    const endDateFilter = searchParams.get('endDate');

    const query: Filter<Document> = {};

    if (adminUserIdFilter) query.adminUserId = { $regex: adminUserIdFilter, $options: 'i' };
    if (actionFilter) query.action = { $regex: actionFilter, $options: 'i' };
    if (targetEntityTypeFilter) query.targetEntityType = targetEntityTypeFilter;
    if (targetEntityIdFilter) query.targetEntityId = { $regex: targetEntityIdFilter, $options: 'i' };
    
    if (startDateFilter || endDateFilter) {
      query.timestamp = {};
      if (startDateFilter) {
        try {
          (query.timestamp as any).$gte = new Date(startDateFilter);
        } catch (e) { /* ignore invalid date */ }
      }
      if (endDateFilter) {
        try {
          const ed = new Date(endDateFilter);
          ed.setHours(23, 59, 59, 999); // Include the whole end day
          (query.timestamp as any).$lte = ed;
        } catch (e) { /* ignore invalid date */ }
      }
      if (Object.keys(query.timestamp).length === 0) delete query.timestamp;
    }

    const logs = await auditLogsCollection
      .find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const totalLogs = await auditLogsCollection.countDocuments(query);

    return NextResponse.json({
      logs,
      totalLogs,
      currentPage: page,
      totalPages: Math.ceil(totalLogs / limit),
      limit,
    });

  } catch (error) {
    console.error('Error fetching admin audit logs:', error);
    // Check if it's a DB connection error or other specific error to refine status code
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
} 