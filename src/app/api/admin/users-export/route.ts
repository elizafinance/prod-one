import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { getSession } from 'next-auth/react'; // Or from 'next-auth' if using app router server-side helpers
import { User } from '@/models/User'; // Assuming you have a User model or will fetch directly

// Helper to check if the user is an admin - adapt to your actual admin check logic
async function isAdmin(req: Request) {
  // For App Router, getting session in route handlers can be tricky.
  // If using next-auth v5 (Auth.js), you might use auth() helper.
  // For older versions or different setups, you might pass a token or use a middleware.
  // This is a placeholder for actual admin authentication logic.
  // const session = await getSession({ req }); // This is more for pages/api routes
  // For now, let's assume a simpler check or that middleware handles admin auth.
  // In a real app, ensure this is secure.
  // For example, if you have an admin role in your User model:
  // const user = await User.findOne({ email: session?.user?.email });
  // return user?.isAdmin === true;
  console.warn("Admin check in /api/admin/users-export is a placeholder. Implement proper admin authentication.");
  return true; // Placeholder - REMOVE IN PRODUCTION unless middleware protects this route
}

export async function GET(req: Request) {
  // Placeholder for proper admin check. 
  // You might use a middleware to protect admin routes instead.
  // const adminCheck = await isAdmin(req);
  // if (!adminCheck) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  // }

  try {
    const client = await clientPromise;
    const db = client.db();

    const users = await db.collection('users')
      .find(
        {},
        {
          projection: {
            _id: 0, // Exclude the MongoDB default ID
            xUsername: 1,
            xId: 1, // Optional: if you want the X ID
            walletAddress: 1,
            points: 1,
            // Add any other fields you want in the CSV
          }
        }
      )
      .toArray();

    if (!users) {
      return NextResponse.json({ error: 'No users found' }, { status: 404 });
    }

    // Filter out users who might be missing critical data for the CSV if necessary
    const cleanedUsers = users.map(user => ({
      xUsername: user.xUsername || 'N/A',
      walletAddress: user.walletAddress || 'N/A',
      points: user.points || 0,
      xId: user.xId || 'N/A' // Optional
    }));

    return NextResponse.json(cleanedUsers, { status: 200 });

  } catch (error) {
    console.error("Error fetching users for export:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Internal Server Error', details: errorMessage }, { status: 500 });
  }
} 