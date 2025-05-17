import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Enriched types for squad details
interface EnrichedSquadMember {
  walletAddress: string;
  xUsername?: string;
  xProfileImageUrl?: string;
  points?: number;
}

interface EnrichedSquadData extends SquadDocument {
  membersFullDetails: EnrichedSquadMember[];
}

// Define the expected response structure, including the leader's referral code
interface SquadDetailsApiResponse {
  squad: SquadDocument & { 
    membersFullDetails?: Array<Partial<UserDocument>>; 
    leaderReferralCode?: string; // Added field
    totalSquadPoints?: number;
  }
}

export async function GET(
  request: Request,
  { params }: { params: { squadId: string } }
) {
  const squadId = params.squadId;

  if (!squadId) {
    return NextResponse.json({ error: 'Squad ID parameter is required' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');
    const usersCollection = db.collection<UserDocument>('users');

    const squad = await squadsCollection.findOne({ squadId });

    if (!squad) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const membersFullDetails: EnrichedSquadMember[] = [];
    if (squad.memberWalletAddresses && squad.memberWalletAddresses.length > 0) {
      const memberUsers = await usersCollection.find(
        { walletAddress: { $in: squad.memberWalletAddresses } },
        { projection: { walletAddress: 1, xUsername: 1, xProfileImageUrl: 1, points: 1, _id: 0 } }
      ).toArray();
      
      // Create a map for quick lookup
      const memberUserMap = new Map<string, Partial<UserDocument>>();
      memberUsers.forEach(member => {
        if (member.walletAddress) {
          memberUserMap.set(member.walletAddress, member);
        }
      });

      // Populate details in the original order of memberWalletAddresses, filtering out those with no user doc
      for (const walletAddr of squad.memberWalletAddresses) {
        let memberDetail: Partial<UserDocument> | undefined = memberUserMap.get(walletAddr);
        
        if (!memberDetail) {
          // Fallback lookup if initial bulk query missed this member (e.g., case-mismatch or late profile creation)
          const fallbackDoc = await usersCollection.findOne({ walletAddress: walletAddr }, { projection: { walletAddress: 1, xUsername: 1, xProfileImageUrl: 1, points: 1, _id: 0 } });
          if (fallbackDoc && fallbackDoc.walletAddress) {
            memberDetail = fallbackDoc as Partial<UserDocument>;
            // No need to add to memberUserMap here as it's a one-off for this iteration
          }
        }

        if (memberDetail && memberDetail.walletAddress) {
          // Normal case – we have a matching user doc.
          membersFullDetails.push({
            walletAddress: walletAddr,
            xUsername: memberDetail.xUsername,
            xProfileImageUrl: memberDetail.xProfileImageUrl,
            points: memberDetail.points,
          });
        } else {
          // Still include the member so counts / ordering remain correct; show bare wallet address.
          console.warn(`User document not found for squad member wallet: ${walletAddr} in squad ${squad.squadId}. Displaying with minimal details.`);
          membersFullDetails.push({
            walletAddress: walletAddr,
            // Leave other fields undefined
          });
        }
      }
    }

    // Fetch the leader's referral code separately
    let leaderReferralCode: string | undefined = undefined;
    if (squad.leaderWalletAddress) {
      const leaderUser = await usersCollection.findOne(
        { walletAddress: squad.leaderWalletAddress },
        { projection: { _id: 0, referralCode: 1 } }
      );
      leaderReferralCode = leaderUser?.referralCode;
    }

    const enrichedSquadData: EnrichedSquadData = {
      ...squad,
      membersFullDetails,
    };

    // Calculate total points dynamically
    const calculatedTotalSquadPoints = membersFullDetails.reduce((sum, member) => sum + (member.points || 0), 0);

    // Combine squad data with member details and leader referral code
    const responsePayload: SquadDetailsApiResponse = {
      squad: {
        ...enrichedSquadData,
        totalSquadPoints: calculatedTotalSquadPoints,
        leaderReferralCode: leaderReferralCode,
      }
    };

    return NextResponse.json(responsePayload);

  } catch (error) {
    console.error(`Error fetching details for squad ${squadId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch squad details' }, { status: 500 });
  }
} 