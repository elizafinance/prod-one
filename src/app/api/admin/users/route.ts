import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ObjectId, Filter, Document } from 'mongodb';
import { AIR } from '@/config/points.config';
import { randomBytes } from 'crypto';
import { isAdminSession } from '@/lib/adminUtils';
import { generateUniqueReferralCode } from '@/lib/auth';

// Function to sync database roles with environment admin wallets
async function syncAdminRoles(db: any) {
  try {
    const adminWallets = process.env.ADMIN_WALLET_ADDRESSES;
    if (!adminWallets) {
      return; // No admin wallets configured
    }

    const adminWalletList = adminWallets
      .split(',')
      .map(wallet => wallet.trim())
      .filter(wallet => wallet.length > 0);

    if (adminWalletList.length === 0) {
      return;
    }

    const usersCollection = db.collection('users');

    // Set admin role for wallets in environment variable
    await usersCollection.updateMany(
      { 
        walletAddress: { $in: adminWalletList },
        role: { $ne: 'admin' }
      },
      { 
        $set: { 
          role: 'admin',
          updatedAt: new Date()
        }
      }
    );

    // Set user role for wallets NOT in environment variable that currently have admin role
    await usersCollection.updateMany(
      { 
        walletAddress: { $nin: adminWalletList },
        role: 'admin'
      },
      { 
        $set: { 
          role: 'user',
          updatedAt: new Date()
        }
      }
    );

  } catch (error) {
    console.error('[SyncAdminRoles] Error syncing admin roles:', error);
    // Don't throw - this is a background sync operation
  }
}

export async function GET(request: NextRequest) {
  const session: any = await getServerSession(authOptions);

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');

    // Sync admin roles before fetching users
    await syncAdminRoles(db);

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const roleFilter = searchParams.get('role');
    const squadIdFilter = searchParams.get('squadId');
    const hasSquadFilter = searchParams.get('hasSquad');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const skip = (page - 1) * limit;
    
    const andConditions: Filter<Document>[] = [];

    if (q) {
      const orConditions: Filter<Document>[] = [
        { walletAddress: { $regex: q, $options: 'i' } },
        { xUsername: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { auth0Id: { $regex: q, $options: 'i' } }
      ];

      if (/^[a-f0-9]{24}$/i.test(q)) {
        try {
          orConditions.push({ _id: new ObjectId(q) });
        } catch (e) {
          console.warn(`Search query "${q}" looks like an ObjectId but failed to parse:`, e);
        }
      }
      andConditions.push({ $or: orConditions });
    }

    if (roleFilter) {
      andConditions.push({ role: roleFilter });
    }

    if (squadIdFilter) {
      andConditions.push({ squadId: squadIdFilter });
    } else if (hasSquadFilter !== null) { 
      if (hasSquadFilter === 'true') {
        andConditions.push({ squadId: { $exists: true, $nin: [null, ''] } });
      } else if (hasSquadFilter === 'false') {
        andConditions.push({
          $or: [
            { squadId: null },
            { squadId: '' },
            { squadId: { $exists: false } }
          ]
        });
      }
    }

    let finalQuery: any = {};
    if (andConditions.length > 0) {
      finalQuery = { $and: andConditions };
    }

    const users = await usersCollection
      .find(finalQuery, { 
        projection: { 
          _id: 1, 
          walletAddress: 1, 
          xUsername: 1, 
          email: 1,
          points: 1, 
          role: 1, 
          squadId: 1, 
          createdAt:1, 
          updatedAt:1,
          auth0Id: 1
        }
      })
      .sort({ createdAt: -1 }) 
      .skip(skip)
      .limit(limit)
      .toArray();
      
    const totalUsers = await usersCollection.countDocuments(finalQuery);

    return NextResponse.json({ 
      users,
      totalUsers,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      limit,
    });

  } catch (dbError) {
    console.error('Database error in GET /api/admin/users:', dbError);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session: any = await getServerSession(authOptions);

  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }
  
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    const idParam = searchParams.get('id');

    if (!walletAddress && !idParam) {
      return NextResponse.json({ error: 'Either wallet or id query param required' }, { status: 400 });
    }

    let targetUserForDelete: any = null;
    if (walletAddress) {
      targetUserForDelete = await usersCollection.findOne({ walletAddress });
    } else if (idParam) {
      try {
        targetUserForDelete = await usersCollection.findOne({ _id: new ObjectId(idParam) });
      } catch (err) {
        return NextResponse.json({ error: 'Invalid id parameter' }, { status: 400 });
      }
    }

    if (!targetUserForDelete) {
        return NextResponse.json({ error: 'User to delete not found' }, { status: 404 });
    }

    const squadsCollection = db.collection('squads');
    const invitationsCollection = db.collection('squadInvitations');
    const joinReqCollection = db.collection('squadJoinRequests');
    const actionsCollection = db.collection('actions');
    const notificationsCollection = db.collection('notifications');

    // Delete user
    const userDel = walletAddress
      ? await usersCollection.deleteOne({ walletAddress })
      : await usersCollection.deleteOne({ _id: targetUserForDelete._id });

    // Remove references in other collections only if a walletAddress exists
    let pullMember = { modifiedCount: 0 } as any;
    let invDel = { modifiedCount: 0 } as any;
    let jrDel = { deletedCount: 0 } as any;
    let actDel = { deletedCount: 0 } as any;
    if (targetUserForDelete.walletAddress) {
      const wa = targetUserForDelete.walletAddress;
      pullMember = await squadsCollection.updateMany(
        { memberWalletAddresses: wa },
        { $pull: { memberWalletAddresses: wa } } as any
      );
      invDel = await invitationsCollection.updateMany(
        {
          $or: [
            { invitedUserWalletAddress: wa },
            { invitedByUserWalletAddress: wa },
          ],
        },
        { $set: { status: 'revoked' } }
      );
      jrDel = await joinReqCollection.deleteMany({ requestingUserWalletAddress: wa });
      actDel = await actionsCollection.deleteMany({ walletAddress: wa });
    }
    const notifQuery: any = { userId: targetUserForDelete._id?.toString() };
    if (targetUserForDelete.walletAddress) {
      notifQuery.$or = [
        { recipientWalletAddress: targetUserForDelete.walletAddress },
        { userId: targetUserForDelete._id?.toString() },
      ];
    }

    const notifDel = await notificationsCollection.deleteMany(notifQuery);

    return NextResponse.json({
      message: 'User purged',
      stats: {
        userDel: userDel.deletedCount,
        squadsUpdated: pullMember.modifiedCount,
        invitationsUpdated: invDel.modifiedCount,
        joinRequestsDeleted: jrDel.deletedCount,
        actionsDeleted: actDel.deletedCount,
        notificationsDeleted: notifDel.deletedCount,
      },
    });
  } catch (dbError) {
    console.error('Database error in DELETE /api/admin/users:', dbError);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session: any = await getServerSession(authOptions);
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { walletAddress, xUsername, email, points, role = 'user' } = body;

    // walletAddress is now optional – admin can create a placeholder user and let them link later.
    if (walletAddress && typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'walletAddress must be a string' }, { status: 400 });
    }
    // If points not supplied, default to the initial connection amount.
    const startingPoints = typeof points === 'number' && points >= 0 ? points : AIR.INITIAL_LOGIN;
    if (role && !['user', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    if (points < 0) {
      return NextResponse.json({ error: 'Points must be non-negative' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    if (walletAddress) {
      const existing = await usersCollection.findOne({ walletAddress });
      if (existing) {
        return NextResponse.json({ error: 'User with this wallet already exists' }, { status: 409 });
      }
    }

    const referralCode = await generateUniqueReferralCode(db);

    // Determine role based on environment admin wallets if wallet address provided
    let finalRole = role;
    if (walletAddress) {
      const adminWallets = process.env.ADMIN_WALLET_ADDRESSES;
      if (adminWallets) {
        const adminWalletList = adminWallets
          .split(',')
          .map(wallet => wallet.trim())
          .filter(wallet => wallet.length > 0);
        
        const isEnvAdmin = adminWalletList.some(adminWallet => 
          adminWallet.toLowerCase() === walletAddress.toLowerCase()
        );
        
        if (isEnvAdmin) {
          finalRole = 'admin';
        }
      }
    }

    const newDoc: Record<string, any> = {
      walletAddress: walletAddress || undefined,
      xUsername: xUsername || undefined,
      email: email || undefined,
      points: startingPoints,
      completedActions: ['initial_connection'],
      referralCode,
      role: finalRole,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertRes = await usersCollection.insertOne(newDoc as any);

    if (!insertRes.acknowledged) {
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }

    const createdUser = await usersCollection.findOne({ _id: insertRes.insertedId });

    return NextResponse.json({ 
      message: 'User created successfully', 
      user: createdUser 
    }, { status: 201 });

  } catch (error) {
    console.error('[AdminUsers] Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 