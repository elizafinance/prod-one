import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { createNotification } from '@/lib/notificationUtils';

interface KickMemberRequestBody {
  memberWalletAddressToKick: string;
}

export async function POST(
  request: Request,
  { params }: { params: { squadId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const leaderWalletAddress = session.user.walletAddress;
  const leaderXUsername = session.user.xUsername || leaderWalletAddress;
  const squadIdToManage = params.squadId;

  if (!squadIdToManage) { return NextResponse.json({ error: 'Squad ID required.' }, { status: 400 });}

  try {
    const body: KickMemberRequestBody = await request.json();
    const { memberWalletAddressToKick } = body;
    if (!memberWalletAddressToKick) { return NextResponse.json({ error: 'Member to kick required.' }, { status: 400 });}
    if (leaderWalletAddress === memberWalletAddressToKick) { return NextResponse.json({ error: 'Leader cannot kick self.' }, { status: 400 });}

    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');
    const usersCollection = db.collection<UserDocument>('users');

    const squad = await squadsCollection.findOne({ squadId: squadIdToManage });
    if (!squad) { return NextResponse.json({ error: 'Squad not found.' }, { status: 404 });}
    if (squad.leaderWalletAddress !== leaderWalletAddress) { return NextResponse.json({ error: 'Only leader can kick.' }, { status: 403 });}
    if (!squad.memberWalletAddresses.includes(memberWalletAddressToKick)) { return NextResponse.json({ error: 'User not in squad.' }, { status: 400 });}

    const kickedUserDoc = await usersCollection.findOne({ walletAddress: memberWalletAddressToKick });

    let pointsToDeduct = 0;
    let kickedUserXUsername = memberWalletAddressToKick; // Default to wallet address

    if (kickedUserDoc) {
      pointsToDeduct = kickedUserDoc.points || 0;
      kickedUserXUsername = kickedUserDoc.xUsername || memberWalletAddressToKick;
      // If user doc exists, unset their squadId
      await usersCollection.updateOne({ walletAddress: memberWalletAddressToKick }, { $unset: { squadId: "" }, $set: { updatedAt: new Date() }});
    } else {
      console.warn(`[KickAPI] User document not found for ${memberWalletAddressToKick}, proceeding with kick from squad list. Points deducted will be 0.`);
    }

    await squadsCollection.updateOne(
      { squadId: squadIdToManage }, 
      { 
        $pull: { memberWalletAddresses: memberWalletAddressToKick }, 
        $set: { updatedAt: new Date() },
      }
    );

    await createNotification(
      db, memberWalletAddressToKick, 'squad_kicked',
      `You have been kicked from the squad "${squad.name}" by the leader @${leaderXUsername}.`,
      squad.squadId, squad.name, leaderWalletAddress, leaderXUsername
    );

    const remainingMembers = squad.memberWalletAddresses.filter(wa => wa !== memberWalletAddressToKick && wa !== leaderWalletAddress);
    for (const memberAddr of remainingMembers) {
      await createNotification(
        db, memberAddr, 'squad_member_left',
        `@${kickedUserXUsername} was kicked from your squad "${squad.name}" by the leader.`,
        squad.squadId, squad.name, memberWalletAddressToKick, kickedUserXUsername
      );
    }

    return NextResponse.json({ message: `Successfully kicked ${memberWalletAddressToKick} from the squad.` });

  } catch (error) {
    console.error(`Error kicking member from squad ${squadIdToManage}:`, error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to kick member' }, { status: 500 });
  }
} 