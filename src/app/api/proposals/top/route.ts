import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// Define a simple interface for a Proposal document
// Adjust this based on your actual Proposal schema in MongoDB
interface Proposal {
  _id: string;
  title: string;
  description: string;
  createdAt: Date;
  // Add other relevant fields like votes, status, etc.
  currentVotes?: number; 
  targetVotes?: number;
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(); // Use your default DB or specify one

    // Fetch the most recent proposal. 
    // You might want to filter by active proposals or sort by votes in a real scenario.
    const topProposal = await db.collection<Proposal>('proposals')
      .find()
      .sort({ createdAt: -1 }) // Sort by creation date, newest first
      .limit(1)
      .toArray();

    if (topProposal.length === 0) {
      return NextResponse.json({ error: 'No proposals found' }, { status: 404 });
    }

    // Assuming currentVotes and targetVotes might not exist on all proposals, provide defaults
    const proposalData = {
      ...topProposal[0],
      id: topProposal[0]._id.toString(), // ensure id is a string
      currentVotes: topProposal[0].currentVotes || 0,
      targetVotes: topProposal[0].targetVotes || 1000, // Default target if not set
    };

    return NextResponse.json(proposalData);
  } catch (error) {
    console.error("Failed to fetch top proposal:", error);
    return NextResponse.json({ error: 'Failed to fetch top proposal' }, { status: 500 });
  }
} 