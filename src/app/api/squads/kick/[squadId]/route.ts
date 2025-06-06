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
  const session = await getServerSession(authOptions) as any;
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

    const kickedUserNotificationTitle = `Removed from ${squad.name}`;
    const kickedUserNotificationMessage = `You have been removed from the squad "${squad.name}" by the leader, @${leaderXUsername || leaderWalletAddress.substring(0,6)}.`;
    const ctaUrlForKicked = `/squads/browse`; // Link to browse other squads

    await createNotification(
      db, 
      memberWalletAddressToKick,          // recipientWalletAddress
      'squad_kicked',                     // type
      kickedUserNotificationTitle,        // title
      kickedUserNotificationMessage,      // message
      ctaUrlForKicked,                    // ctaUrl
      undefined,                          // relatedQuestId
      undefined,                          // relatedQuestTitle
      squad.squadId,                      // relatedSquadId
      squad.name,                         // relatedSquadName
      leaderWalletAddress,                // relatedUserId (the leader who kicked)
      leaderXUsername                     // relatedUserName (leader's name)
      // No relatedInvitationId
    );

    const remainingMembers = squad.memberWalletAddresses.filter(wa => wa !== memberWalletAddressToKick && wa !== leaderWalletAddress);
    const remainingMemberNotificationTitle = `@${kickedUserXUsername} Left Squad`;
    const remainingMemberNotificationMessage = `@${kickedUserXUsername} was removed from your squad, "${squad.name}", by the leader.`;
    const squadPageCtaUrl = squad.squadId ? `/squads/${squad.squadId}` : '/squads';

    for (const memberAddr of remainingMembers) {
      await createNotification(
        db, 
        memberAddr,                            // recipientWalletAddress
        'squad_member_left',                 // type (user left, albeit by kick)
        remainingMemberNotificationTitle,      // title
        remainingMemberNotificationMessage,    // message
        squadPageCtaUrl,                       // ctaUrl
        undefined,                             // relatedQuestId
        undefined,                             // relatedQuestTitle
        squad.squadId,                         // relatedSquadId
        squad.name,                            // relatedSquadName
        memberWalletAddressToKick,             // relatedUserId (the user who was kicked/left)
        kickedUserXUsername                    // relatedUserName (name of the user who was kicked/left)
        // No relatedInvitationId
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