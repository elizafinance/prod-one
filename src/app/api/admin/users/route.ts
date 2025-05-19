import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ObjectId, Filter, Document } from 'mongodb';

export async function GET(request: NextRequest) {
  const session: any = await getServerSession(authOptions);

  if (!session?.user?.role || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
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
      andConditions.push({
        $or: [
          { walletAddress: { $regex: q, $options: 'i' } },
          { xUsername: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ]
      });
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

    let finalQuery: Filter<Document> = {};
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

  if (!session?.user?.role || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }
  
  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    if (!walletAddress) {
      return NextResponse.json({ error: 'wallet query param required' }, { status: 400 });
    }

    const targetUserForDelete = await usersCollection.findOne({ walletAddress: walletAddress });
    if (!targetUserForDelete) {
        return NextResponse.json({ error: 'User to delete not found' }, { status: 404 });
    }

    const squadsCollection = db.collection('squads');
    const invitationsCollection = db.collection('squadInvitations');
    const joinReqCollection = db.collection('squadJoinRequests');
    const actionsCollection = db.collection('actions');
    const notificationsCollection = db.collection('notifications');

    const userDel = await usersCollection.deleteOne({ walletAddress });
    const pullMember = await squadsCollection.updateMany(
      { memberWalletAddresses: walletAddress },
      { $pull: { memberWalletAddresses: walletAddress } } as any
    );
    const invDel = await invitationsCollection.updateMany(
      {
        $or: [
          { invitedUserWalletAddress: walletAddress },
          { invitedByUserWalletAddress: walletAddress },
        ],
      },
      { $set: { status: 'revoked' } }
    );
    const jrDel = await joinReqCollection.deleteMany({ requestingUserWalletAddress: walletAddress });
    const actDel = await actionsCollection.deleteMany({ walletAddress });
    const notifDel = await notificationsCollection.deleteMany({ 
        $or: [
            { recipientWalletAddress: walletAddress }, 
            { userId: targetUserForDelete._id?.toString() } 
        ]
     });

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
  if (!session?.user?.role || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { walletAddress, xUsername, email, points = 0, role = 'user' } = body;

    if (!walletAddress || typeof walletAddress !== 'string') {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }
    if (role && !['user', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }
    if (points < 0) {
      return NextResponse.json({ error: 'Points must be non-negative' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const usersCollection = db.collection('users');

    // Ensure unique wallet
    const existing = await usersCollection.findOne({ walletAddress });
    if (existing) {
      return NextResponse.json({ error: 'User with this wallet already exists' }, { status: 409 });
    }

    const newDoc = {
      walletAddress,
      xUsername: xUsername || undefined,
      email: email || undefined,
      points,
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const insertRes = await usersCollection.insertOne(newDoc as any);

    if (!insertRes.acknowledged) {
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }

    return NextResponse.json({ message: 'User created', user: { _id: insertRes.insertedId, ...newDoc } }, { status: 201 });
  } catch (err) {
    console.error('admin create user error', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
} 