import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import type { NotificationDocument } from '@/lib/mongodb';

// Helper function for Admin Audit Logging (can be moved to a separate file later)
async function logAdminAction(db: any, adminUserId: string, action: string, targetEntityType: string, targetEntityId: string, changes: any, reason?: string) {
  const auditLogsCollection = db.collection('adminAuditLogs');
  try {
    await auditLogsCollection.insertOne({
      timestamp: new Date(),
      adminUserId,
      action, 
      targetEntityType, 
      targetEntityId, 
      changes, 
      reason, 
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { walletAddress: string } }
) {
  const session: any = await getServerSession(authOptions);
  if (!session?.user?.role || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  const walletAddress = params.walletAddress;
  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address parameter is required' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const actionsCollection = db.collection('actions');
    const notificationsCollection = db.collection('notifications');

    const user = await usersCollection.findOne({ walletAddress });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const recentActions = await actionsCollection
      .find({ walletAddress })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    let recentNotifications: NotificationDocument[] = [];
    if (user._id) { 
        recentNotifications = await notificationsCollection
        .find({ userId: user._id.toString() })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray() as NotificationDocument[];
    } else if (user.id) { 
        recentNotifications = await notificationsCollection
        .find({ userId: user.id })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray() as NotificationDocument[];
    }

    return NextResponse.json({ user, recentActions, recentNotifications });
  } catch (error) {
    console.error(`Error fetching details for user ${walletAddress}:`, error);
    return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { walletAddress: string } }
) {
  const session: any = await getServerSession(authOptions);
  const adminUserForLog = session?.user as any; // For logging, use existing next-auth session user
  
  if (!adminUserForLog?.role || adminUserForLog.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  const walletAddress = params.walletAddress;
  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address parameter is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { points, role, reason } = body;

    if (points === undefined && role === undefined) {
      return NextResponse.json({ error: 'No updateable fields provided (points or role)' }, { status: 400 });
    }
    if (points !== undefined && typeof points !== 'number'){
      return NextResponse.json({ error: 'Points must be a number' }, { status: 400 });
    }
    if (role !== undefined && (typeof role !== 'string' || !['user', 'admin'].includes(role))){
      return NextResponse.json({ error: 'Invalid role. Must be "user" or "admin"' }, { status: 400 });
    }
    if (points !== undefined && !reason) {
        return NextResponse.json({ error: 'A reason is required when updating points' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ walletAddress });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updateDoc: any = { $set: {} };
    const changes: any = {};

    if (points !== undefined && user.points !== points) {
      updateDoc.$set.points = points;
      changes.points = { old: user.points, new: points };
    }
    if (role !== undefined && user.role !== role) {
      updateDoc.$set.role = role;
      changes.role = { old: user.role, new: role };
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ message: 'No changes detected or applied.', user }, { status: 200 });
    }

    const result = await usersCollection.updateOne({ walletAddress }, updateDoc);

    if (result.modifiedCount === 0 && result.matchedCount > 0) {
      return NextResponse.json({ message: 'User found, but no changes applied (data might be the same).' }, { status: 200 });
    }
    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Failed to update user or user not found' }, { status: 404 });
    }

    // Log the admin action using next-auth admin user details
    const adminIdentifier = adminUserForLog.walletAddress || adminUserForLog.id || adminUserForLog.email || 'unknown_admin';
    await logAdminAction(db, adminIdentifier, 'update_user_details', 'user', walletAddress, changes, reason);

    const updatedUser = await usersCollection.findOne({ walletAddress });
    return NextResponse.json({ message: 'User updated successfully', user: updatedUser });

  } catch (error: any) {
    console.error(`Error updating user ${walletAddress}:`, error);
    if (error instanceof SyntaxError) { 
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update user details', details: error.message }, { status: 500 });
  }
} 