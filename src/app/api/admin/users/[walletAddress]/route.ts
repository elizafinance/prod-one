import { NextResponse } from 'next/server';
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
      adminUserId, // ID of the admin performing the action
      action, // e.g., 'update_user_points', 'change_user_role', 'purge_user'
      targetEntityType, // e.g., 'user', 'squad', 'quest'
      targetEntityId, // Wallet address, squadId, questId etc.
      changes, // Object detailing what was changed, e.g., { points: { old: 100, new: 150 } }
      reason, // Optional: reason for the change
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
    // Decide if this failure should block the main operation or just be logged
  }
}


export async function GET(
  request: Request,
  { params }: { params: { walletAddress: string } }
) {
  const session: any = await (getServerSession as any)(authOptions);
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

    // Fetch last 10 actions for this user
    const recentActions = await actionsCollection
      .find({ walletAddress })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    // Fetch last 10 notifications for this user (if userId is an ObjectId on user doc)
    // Assuming user._id is the correct field for linking notifications.
    // If notifications are linked by walletAddress directly, adjust the query.
    let recentNotifications: NotificationDocument[] = [];
    if (user._id) { // Check if _id exists and is an ObjectId
        recentNotifications = await notificationsCollection
        .find({ userId: user._id.toString() }) // Use user._id if it's an ObjectId stored as string, or user._id directly
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray() as NotificationDocument[];
    } else if (user.id) { // Fallback if user.id is used (and is string)
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
  request: Request,
  { params }: { params: { walletAddress: string } }
) {
  const session: any = await (getServerSession as any)(authOptions);
  const adminUser = session?.user as any; // For logging
  if (!adminUser?.role || adminUser.role !== 'admin') {
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
      return NextResponse.json({ error: 'Failed to update user or user not found' }, { status: 404 }); // Or 500 if it should have updated
    }

    // Log the admin action
    const adminWallet = adminUser.walletAddress || adminUser.id || 'unknown_admin'; // Get admin identifier
    await logAdminAction(db, adminWallet, 'update_user_details', 'user', walletAddress, changes, reason);

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