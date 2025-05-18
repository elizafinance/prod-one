import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getPointsService, AwardPointsOptions } from '@/services/points.service';

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

    let recentNotifications: any[] = [];
    if (user._id) { 
        recentNotifications = await notificationsCollection
        .find({ userId: user._id.toString() })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
    } else if ((user as any).id) {
        recentNotifications = await notificationsCollection
        .find({ userId: (user as any).id })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();
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
  const adminUserForLog = session?.user as any;
  
  if (!adminUserForLog?.role || adminUserForLog.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  const targetWalletAddress = params.walletAddress;
  if (!targetWalletAddress) {
    return NextResponse.json({ error: 'Target wallet address parameter is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { points, role, reason } = body;

    if (points === undefined && role === undefined) {
      return NextResponse.json({ error: 'No updateable fields provided (points or role)' }, { status: 400 });
    }
    if (points !== undefined && (typeof points !== 'number' || points < 0)){
      return NextResponse.json({ error: 'Points must be a non-negative number' }, { status: 400 });
    }
    if (role !== undefined && (typeof role !== 'string' || !['user', 'admin'].includes(role))){
      return NextResponse.json({ error: 'Invalid role. Must be "user" or "admin"' }, { status: 400 });
    }
    if (points !== undefined && !reason) {
        return NextResponse.json({ error: 'A reason is required when updating points' }, { status: 400 });
    }
    if (role !== undefined && !reason) {
        return NextResponse.json({ error: 'A reason is required when updating role' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const pointsService = await getPointsService();

    const userBeforeUpdate = await usersCollection.findOne({ walletAddress: targetWalletAddress });
    if (!userBeforeUpdate) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const changes: any = {};
    let updatedUser: UserDocument | null = null;

    if (points !== undefined && userBeforeUpdate.points !== points) {
      const awardOptions: AwardPointsOptions = {
        reason: `admin:set_points:${reason}`,
        metadata: { adminUserId: adminUserForLog.dbId || adminUserForLog.xId || adminUserForLog.walletAddress, reason },
        actionType: 'admin_points_set'
      };
      updatedUser = await pointsService.setPoints(targetWalletAddress, points, awardOptions);
      if (updatedUser) {
        changes.points = { old: userBeforeUpdate.points, new: updatedUser.points };
      } else {
        return NextResponse.json({ error: 'Failed to update points via PointsService' }, { status: 500 });
      }
    }

    if (role !== undefined && userBeforeUpdate.role !== role) {
      const roleUpdateResult = await usersCollection.updateOne(
        { walletAddress: targetWalletAddress }, 
        { $set: { role: role, updatedAt: new Date() } }
      );
      if (roleUpdateResult.modifiedCount > 0) {
        changes.role = { old: userBeforeUpdate.role, new: role };
        if (!updatedUser) {
            updatedUser = await usersCollection.findOne({ walletAddress: targetWalletAddress });
        }
         if (updatedUser) updatedUser.role = role;

      } else if (roleUpdateResult.matchedCount === 0) {
         return NextResponse.json({ error: 'User not found for role update' }, { status: 404 });
      }
    }

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ message: 'No changes detected or applied.', user: userBeforeUpdate }, { status: 200 });
    }

    const adminIdentifier = adminUserForLog.walletAddress || adminUserForLog.dbId || adminUserForLog.xId || 'unknown_admin';
    if (Object.keys(changes).length > 0) {
        await logAdminAction(db, adminIdentifier, 'update_user_details', 'user', targetWalletAddress, changes, reason);
    }

    const finalUser = updatedUser || await usersCollection.findOne({ walletAddress: targetWalletAddress });

    return NextResponse.json({ message: 'User updated successfully', user: finalUser });

  } catch (error: any) {
    console.error(`Error updating user ${targetWalletAddress}:`, error);
    if (error instanceof SyntaxError) { 
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update user details', details: error.message }, { status: 500 });
  }
} 