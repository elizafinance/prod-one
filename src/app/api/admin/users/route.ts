import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { ObjectId, Filter, Document } from 'mongodb';

export async function GET(request: Request) {
  const session: any = await (getServerSession as any)(authOptions);
  if (!session?.user?.role || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const roleFilter = searchParams.get('role');
  const squadIdFilter = searchParams.get('squadId');
  const hasSquadFilter = searchParams.get('hasSquad'); // 'true' or 'false'
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const skip = (page - 1) * limit;
  
  const andConditions: Filter<Document>[] = [];

  if (q) {
    andConditions.push({
      $or: [
        { walletAddress: { $regex: q, $options: 'i' } },
        { xUsername: { $regex: q, $options: 'i' } },
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
  // If andConditions.length is 0, finalQuery remains {} which means find all

  const users = await usersCollection
    .find(finalQuery, { 
      projection: { 
        _id: 1, 
        walletAddress: 1, 
        xUsername: 1, 
        points: 1, 
        role: 1, 
        squadId: 1, 
        createdAt:1, 
        updatedAt:1 
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
    // queryApplied: query // For debugging, optional
  });
}

// DELETE /api/admin/users?wallet=...
export async function DELETE(request: Request) {
  const session: any = await (getServerSession as any)(authOptions);
  if (!session?.user?.role || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Requires admin privileges' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('wallet');
  if (!walletAddress) {
    return NextResponse.json({ error: 'wallet query param required' }, { status: 400 });
  }

  const { db } = await connectToDatabase();
  const usersCollection = db.collection('users');
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
  const notifDel = await notificationsCollection.deleteMany({ relatedUserId: walletAddress });

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
} 