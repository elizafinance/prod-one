import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import profanityList from '@/data/profanity-list.json'; // Reusing profanity list

interface EditSquadRequestBody {
  squadName?: string;
  description?: string;
}

// Function to check for profanity (can be moved to a shared util if used in multiple places)
function containsProfanity(text: string, list: string[]): boolean {
  if (!text) return false;
  const lowerCaseText = text.toLowerCase();
  return list.some(badWord => lowerCaseText.includes(badWord.toLowerCase()));
}

export async function PATCH(
  request: Request,
  { params }: { params: { squadId: string } }
) {
  const session = await getServerSession(authOptions) as any;
  if (!session || !session.user || typeof session.user.walletAddress !== 'string') {
    return NextResponse.json({ error: 'User not authenticated or wallet not available in session' }, { status: 401 });
  }
  const editorWalletAddress = session.user.walletAddress;
  const squadIdToEdit = params.squadId;

  if (!squadIdToEdit) {
    return NextResponse.json({ error: 'Squad ID parameter is required' }, { status: 400 });
  }

  try {
    const body: EditSquadRequestBody = await request.json();
    const { squadName, description } = body;

    if (!squadName && typeof description === 'undefined') {
      return NextResponse.json({ error: 'At least one field (squadName or description) must be provided for update.' }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const squadsCollection = db.collection<SquadDocument>('squads');
    // const usersCollection = db.collection<UserDocument>('users'); // Not needed for this specific update if only editing squad doc

    const squad = await squadsCollection.findOne({ squadId: squadIdToEdit });
    if (!squad) {
      return NextResponse.json({ error: 'Squad not found.' }, { status: 404 });
    }

    // Authorization: Only the squad leader can edit
    if (squad.leaderWalletAddress !== editorWalletAddress) {
      return NextResponse.json({ error: 'Only the squad leader can edit squad details.' }, { status: 403 }); // Forbidden
    }

    const updates: Partial<SquadDocument> = { updatedAt: new Date() };

    if (squadName) {
      if (squadName.length < 3 || squadName.length > 30) {
        return NextResponse.json({ error: 'New squad name must be between 3 and 30 characters' }, { status: 400 });
      }
      if (containsProfanity(squadName, profanityList)) {
        return NextResponse.json({ error: 'New squad name contains inappropriate language.' }, { status: 400 });
      }
      // Check for name uniqueness if new name is different from old one
      if (squadName !== squad.name) {
        const existingSquadWithNewName = await squadsCollection.findOne({ name: squadName });
        if (existingSquadWithNewName) {
          return NextResponse.json({ error: 'A squad with this new name already exists.' }, { status: 400 });
        }
      }
      updates.name = squadName;
    }

    if (typeof description !== 'undefined') { // Allow empty string for description
      if (description.length > 150) {
         return NextResponse.json({ error: 'Description cannot exceed 150 characters' }, { status: 400 });
      }
      if (containsProfanity(description, profanityList)) {
        return NextResponse.json({ error: 'New squad description contains inappropriate language.' }, { status: 400 });
      }
      updates.description = description;
    }

    const result = await squadsCollection.updateOne(
      { squadId: squadIdToEdit },
      { $set: updates }
    );

    if (result.modifiedCount === 0 && result.matchedCount > 0) {
        return NextResponse.json({ message: 'No changes detected or applied.', squad: await squadsCollection.findOne({ squadId: squadIdToEdit }) });
    }
    if (result.matchedCount === 0) {
        return NextResponse.json({ error: 'Squad not found for update (should have been caught earlier).' }, { status: 404 });
    }

    const updatedSquad = await squadsCollection.findOne({ squadId: squadIdToEdit });
    return NextResponse.json({ message: 'Squad updated successfully!', squad: updatedSquad });

  } catch (error) {
    console.error(`Error editing squad ${squadIdToEdit}:`, error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to edit squad' }, { status: 500 });
  }
} 