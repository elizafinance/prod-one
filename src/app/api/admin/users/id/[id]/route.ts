import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getPointsService, AwardPointsOptions } from '@/services/points.service';
import { ObjectId } from 'mongodb';
import { isAdminSession } from '@/lib/adminUtils';

// Helper function for Admin Audit Logging
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
  { params }: { params: { id: string } }
) {
  const session: any = await getServerSession(authOptions);
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 });
  }
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const actionsCollection = db.collection('actions');
    const notificationsCollection = db.collection('notifications');

    const user = await usersCollection.findOne({ _id: new ObjectId(id) });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch recent actions - Note: actions are typically linked by walletAddress.
    // If user document has walletAddress, use it. Otherwise, this might return empty.
    let recentActions: any[] = [];
    if (user.walletAddress) {
        recentActions = await actionsCollection
        .find({ walletAddress: user.walletAddress })
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray();
    }


    // Fetch recent notifications by wallet address (same field used by regular notifications API)
    let recentNotifications: any[] = [];
    if (user.walletAddress) {
        recentNotifications = await notificationsCollection
            .find({ recipientWalletAddress: user.walletAddress })
            .sort({ createdAt: -1 })
            .limit(10)
            .toArray();
    }
    

    return NextResponse.json({ user, recentActions, recentNotifications });
  } catch (error) {
    console.error(`Error fetching details for user ${id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session: any = await getServerSession(authOptions);
  const adminUserForLog = session?.user as any;
  
  if (!isAdminSession({ user: adminUserForLog })) {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  const targetId = params.id;
  if (!targetId) {
    return NextResponse.json({ error: 'Target ID parameter is required' }, { status: 400 });
  }
  if (!ObjectId.isValid(targetId)) {
    return NextResponse.json({ error: 'Invalid target ID format' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { points, role, reason, walletAddress: newWalletAddress } = body; // Added newWalletAddress

    if (points === undefined && role === undefined && newWalletAddress === undefined) {
      return NextResponse.json({ error: 'No updateable fields provided (points, role, or walletAddress)' }, { status: 400 });
    }
    if (points !== undefined && (typeof points !== 'number' || points < 0)){
      return NextResponse.json({ error: 'Points must be a non-negative number' }, { status: 400 });
    }
    if (role !== undefined && (typeof role !== 'string' || !['user', 'admin'].includes(role))){
      return NextResponse.json({ error: 'Invalid role. Must be "user" or "admin"' }, { status: 400 });
    }
    if (newWalletAddress !== undefined && typeof newWalletAddress !== 'string') {
        return NextResponse.json({ error: 'WalletAddress must be a string if provided' }, { status: 400 });
    }
    // Require reason for points or role changes
    if ((points !== undefined || role !== undefined) && !reason) {
        return NextResponse.json({ error: 'A reason is required when updating points or role' }, { status: 400 });
    }
    // Require reason for wallet changes if it's the only change. If other changes also have reason, that's fine.
    if (newWalletAddress !== undefined && points === undefined && role === undefined && !reason) {
      return NextResponse.json({ error: 'A reason is required when updating wallet address' }, { status: 400 });
    }


    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const pointsService = await getPointsService();

    const userObjectId = new ObjectId(targetId);
    const userBeforeUpdate = await usersCollection.findOne({ _id: userObjectId });
    if (!userBeforeUpdate) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // If trying to set a new walletAddress, ensure it's not already in use by another user
    if (newWalletAddress && newWalletAddress !== userBeforeUpdate.walletAddress) {
        const existingUserWithWallet = await usersCollection.findOne({ walletAddress: newWalletAddress });
        if (existingUserWithWallet && existingUserWithWallet._id.toString() !== targetId) {
            return NextResponse.json({ error: 'This wallet address is already linked to another user.' }, { status: 409 });
        }
    }

    const changes: any = {};
    const updateSet: any = { updatedAt: new Date() };
    let updatedUserDocument: UserDocument | null = null; // To store the state after points/role/wallet updates

    // Points update (requires user to have a walletAddress for points service)
    if (points !== undefined && userBeforeUpdate.points !== points) {
      if (!userBeforeUpdate.walletAddress && !newWalletAddress) {
        return NextResponse.json({ error: 'Cannot set points for a user without a wallet address. Please link a wallet first.' }, { status: 400 });
      }
      const walletForPoints = newWalletAddress || userBeforeUpdate.walletAddress;
      if (!walletForPoints) { // Should be caught by above, but as a safeguard
         return NextResponse.json({ error: 'Wallet address is required for points operations.' }, { status: 400 });
      }

      const awardOptions: AwardPointsOptions = {
        reason: `admin:set_points:${reason}`,
        metadata: { adminUserId: adminUserForLog.dbId || adminUserForLog.xId || adminUserForLog.walletAddress, reason },
        actionType: 'admin_points_set'
      };
      // Points service operates on walletAddress.
      // If walletAddress is being changed AND points are changing, we need to handle order or make assumptions.
      // Let's assume points service should use the NEW wallet if provided, or existing if not.
      updatedUserDocument = await pointsService.setPoints(walletForPoints, points, awardOptions);
      if (updatedUserDocument) {
        changes.points = { old: userBeforeUpdate.points, new: updatedUserDocument.points };
      } else {
        // If pointsService couldn't find/update user (e.g. new wallet not yet set if it's a new user), this is an issue.
        // For now, we assume pointsService can handle a new walletAddress if it's being set.
        // Or, we could require wallet to be set first in a separate PATCH.
        // For simplicity, let's assume pointsService works with the target wallet string.
        return NextResponse.json({ error: 'Failed to update points via PointsService. Ensure user has a wallet address.' }, { status: 500 });
      }
    }

    // Role update
    if (role !== undefined && userBeforeUpdate.role !== role) {
      updateSet.role = role;
      changes.role = { old: userBeforeUpdate.role, new: role };
    }

    // WalletAddress update
    if (newWalletAddress !== undefined && userBeforeUpdate.walletAddress !== newWalletAddress) {
        updateSet.walletAddress = newWalletAddress; // Can be an empty string to "unlink"
        changes.walletAddress = { old: userBeforeUpdate.walletAddress, new: newWalletAddress };
        // If points were updated, pointsService already used the newWalletAddress.
        // If actions were tied to old wallet, they remain. New actions will use new wallet.
    }


    if (Object.keys(updateSet).length > 1) { // updatedAt is always there
      const updateResult = await usersCollection.updateOne(
        { _id: userObjectId }, 
        { $set: updateSet }
      );
      if (updateResult.modifiedCount === 0 && updateResult.matchedCount > 0 && points === undefined) { // if only points changed, updatedUserDocument is source of truth
        // No direct fields changed if only points were modified, or no actual value change
      } else if (updateResult.matchedCount === 0) {
         return NextResponse.json({ error: 'User not found during update' }, { status: 404 });
      }
    }
    
    // Consolidate the final user state
    let finalUser = await usersCollection.findOne({ _id: userObjectId }); // Always fetch the latest from DB

    if (Object.keys(changes).length === 0) {
      return NextResponse.json({ message: 'No changes detected or applied.', user: finalUser || userBeforeUpdate }, { status: 200 });
    }

    const adminIdentifier = adminUserForLog.walletAddress || adminUserForLog.dbId || adminUserForLog.xId || 'unknown_admin';
    // Use targetId (user's _id.toString()) for logging consistency
    await logAdminAction(db, adminIdentifier, 'update_user_details_by_id', 'user', targetId, changes, reason);
    
    return NextResponse.json({ message: 'User updated successfully', user: finalUser });

  } catch (error: any) {
    console.error(`Error updating user by ID ${targetId}:`, error);
    if (error instanceof SyntaxError) { 
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update user details', details: error.message }, { status: 500 });
  }
} 