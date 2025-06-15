import { NextResponse } from 'next/server';
import { connectToDatabase, UserDocument, SquadDocument } from '@/lib/mongodb';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

/**
 * Fix Squad Membership API - Maintenance Tool
 * 
 * This endpoint helps resolve data consistency issues where users are listed
 * in squad member arrays but their user records don't have the correct squadId.
 * 
 * NOTE: The main authentication issue has been fixed. This endpoint is kept for:
 * - Support team to help users with edge case issues
 * - Emergency debugging of data consistency problems
 * - Users who may have been affected by the previous auth migration
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions) as any;
  
  // Check authentication
  if (!session || !session.user || !session.user.xId) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  const userXId = session.user.xId;

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const squadsCollection = db.collection<SquadDocument>('squads');

    // Get the user's record
    const userRecord = await usersCollection.findOne({ xUserId: userXId });
    
    if (!userRecord || !userRecord.walletAddress) {
      return NextResponse.json({ error: 'User record not found or wallet not connected' }, { status: 404 });
    }

    const userWalletAddress = userRecord.walletAddress;
    
    // Check if user is listed as a member in any squad
    const squadsWithUser = await squadsCollection.find({
      memberWalletAddresses: userWalletAddress
    }).toArray();

    let fixedIssue = false;
    let currentSquad = null;

    if (squadsWithUser.length === 0) {
      // User is not in any squad's member list
      if (userRecord.squadId) {
        // User has a squadId but isn't in any squad - remove it
        await usersCollection.updateOne(
          { xUserId: userXId },
          { 
            $unset: { squadId: "" },
            $set: { updatedAt: new Date() }
          }
        );
        fixedIssue = true;
        return NextResponse.json({ 
          message: 'Fixed: Removed invalid squad reference from your account',
          fixed: true,
          squad: null
        });
      } else {
        return NextResponse.json({ 
          message: 'No squad membership issues found - you are not in any squad',
          fixed: false,
          squad: null
        });
      }
    } else if (squadsWithUser.length === 1) {
      // User is in exactly one squad (normal case)
      const squad = squadsWithUser[0];
      currentSquad = squad;
      
      if (userRecord.squadId !== squad.squadId) {
        // Fix the user's squadId
        await usersCollection.updateOne(
          { xUserId: userXId },
          { 
            $set: { 
              squadId: squad.squadId,
              updatedAt: new Date()
            }
          }
        );
        fixedIssue = true;
        return NextResponse.json({ 
          message: `Fixed: Linked your account to squad "${squad.name}"`,
          fixed: true,
          squad: {
            squadId: squad.squadId,
            name: squad.name
          }
        });
      } else {
        return NextResponse.json({ 
          message: `No issues found - you are correctly linked to squad "${squad.name}"`,
          fixed: false,
          squad: {
            squadId: squad.squadId,
            name: squad.name
          }
        });
      }
    } else {
      // User is in multiple squads (data corruption - shouldn't happen)
      console.error(`[FixMembership] User ${userWalletAddress} is in multiple squads:`, squadsWithUser.map(s => s.name));
      
      // Take the most recent squad (by updatedAt or createdAt)
      const mostRecentSquad = squadsWithUser.sort((a, b) => 
        (b.updatedAt || b.createdAt).getTime() - (a.updatedAt || a.createdAt).getTime()
      )[0];
      
      // Remove user from all other squads
      for (const squad of squadsWithUser) {
        if (squad.squadId !== mostRecentSquad.squadId) {
          await squadsCollection.updateOne(
            { squadId: squad.squadId },
            { 
              $pull: { memberWalletAddresses: userWalletAddress as any },
              $set: { updatedAt: new Date() }
            }
          );
        }
      }
      
      // Update user's squadId to the most recent squad
      await usersCollection.updateOne(
        { xUserId: userXId },
        { 
          $set: { 
            squadId: mostRecentSquad.squadId,
            updatedAt: new Date()
          }
        }
      );
      
      fixedIssue = true;
      return NextResponse.json({ 
        message: `Fixed: Resolved multiple squad memberships - you are now in squad "${mostRecentSquad.name}"`,
        fixed: true,
        squad: {
          squadId: mostRecentSquad.squadId,
          name: mostRecentSquad.name
        }
      });
    }

  } catch (error) {
    console.error('[FixMembership] Error:', error);
    return NextResponse.json({ error: 'Failed to fix squad membership' }, { status: 500 });
  }
} 