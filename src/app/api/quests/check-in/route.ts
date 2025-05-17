import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase, MeetupCheckInDocument, UserDocument } from '@/lib/mongodb';
// CommunityQuestModel not directly used for DB query here, but good for type context if needed elsewhere.
// import CommunityQuestModel from '@/models/communityQuest.model'; 
import { ObjectId } from 'mongodb';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

interface CheckInRequestBody {
  questId: string;          // ObjectId string of the CommunityQuest
  squadId: string;          // squadId string (not ObjectId, as per SquadDocument)
  latitude: number;
  longitude: number;
  accuracy: number;         // Geolocation accuracy in meters
  clientTimestamp: string;  // ISO string timestamp from the client
  signedMessage: string;    // The exact UTF-8 string message that was signed by the user
  signature: string;        // The signature, base64 encoded string
}

// Helper to construct the message for verification (must match client-side construction)
const constructSignableMessage = (params: {
  questId: string,
  squadId: string,
  latitude: number,
  longitude: number,
  clientTimestampISO: string
}) => {
  // Standardized message format, ensure precision for lat/lon matches client signing
  return `DeFAI Squad Meetup Check-in: QuestID=${params.questId}, SquadID=${params.squadId}, Lat=${params.latitude.toFixed(6)}, Lon=${params.longitude.toFixed(6)}, Timestamp=${params.clientTimestampISO}`;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions) as any;

  if (!session || !session.user || !session.user.dbId || !session.user.walletAddress) {
    return NextResponse.json({ error: 'Unauthorized: User not authenticated or missing essential details' }, { status: 401 });
  }

  const currentUserDbId = session.user.dbId;
  const currentUserWalletAddress = session.user.walletAddress;

  let body: CheckInRequestBody;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const {
    questId,
    squadId,
    latitude,
    longitude,
    accuracy,
    clientTimestamp,
    signedMessage,
    signature
  } = body;

  // Basic validation
  if (!questId || !squadId || typeof latitude !== 'number' || typeof longitude !== 'number' || typeof accuracy !== 'number' || !clientTimestamp || !signedMessage || !signature) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!ObjectId.isValid(questId)) {
    return NextResponse.json({ error: 'Invalid questId format' }, { status: 400 });
  }

  let clientDate: Date;
  try {
    clientDate = new Date(clientTimestamp);
    if (isNaN(clientDate.getTime())) throw new Error('Invalid date');
  } catch (e) {
    return NextResponse.json({ error: 'Invalid clientTimestamp format' }, { status: 400 });
  }
  
  const expectedMessage = constructSignableMessage({
    questId,
    squadId,
    latitude,
    longitude,
    clientTimestampISO: clientDate.toISOString()
  });

  if (signedMessage !== expectedMessage) {
    console.error("Signed message mismatch. Client signed:", signedMessage, "Server expected:", expectedMessage);
    return NextResponse.json({ error: 'Signed message does not match expected format. Potential tampering or client-server mismatch.' }, { status: 400 });
  }

  try {
    const messageBytes = new TextEncoder().encode(signedMessage);
    const signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));
    const publicKeyBytes = bs58.decode(currentUserWalletAddress);

    if (!nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }
  } catch (error) {
    console.error("Signature verification error:", error);
    return NextResponse.json({ error: 'Signature verification failed. Ensure public key and signature format are correct.' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();

    const questObjectId = new ObjectId(questId);
    // Using db.collection('communityquests') directly, CommunityQuestModel import is not strictly needed for this operation
    const quest = await db.collection('communityquests').findOne({ 
        _id: questObjectId,
        status: 'active',
        scope: 'squad',
        goal_type: 'squad_meetup',
        start_ts: { $lte: new Date() },
        end_ts: { $gte: new Date() }
    });

    if (!quest) {
      return NextResponse.json({ error: 'Active squad meetup quest not found or not currently valid' }, { status: 404 });
    }

    const user = await db.collection<UserDocument>('users').findOne({ _id: new ObjectId(currentUserDbId) });
    if (!user || user.squadId !== squadId) {
      return NextResponse.json({ error: 'User is not a member of the specified squad' }, { status: 403 });
    }
    
    const meetupCheckInsCollection = db.collection<MeetupCheckInDocument>('meetup_check_ins');
    const newCheckIn: Omit<MeetupCheckInDocument, '_id'> = {
      questId: questObjectId,
      squadId: squadId,
      userId: currentUserDbId,
      walletAddress: currentUserWalletAddress,
      latitude,
      longitude,
      accuracy,
      clientTimestamp: clientDate,
      serverTimestamp: new Date(),
      signedMessage,
      signature,
      status: 'pending_match',
    };

    const result = await meetupCheckInsCollection.insertOne(newCheckIn as MeetupCheckInDocument);

    return NextResponse.json({ 
        message: 'Check-in submitted successfully. Pending match.', 
        checkInId: result.insertedId 
    }, { status: 201 });

  } catch (error: any) {
    console.error('[Meetup Check-In POST] Error:', error);
    if (error.name === 'ValidationError') {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to process check-in', details: error.message }, { status: 500 });
  }
} 