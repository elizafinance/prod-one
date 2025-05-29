import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, AuthenticatedUser } from './authSession'; // Existing app session helper
import { verifyCrossmintJwt } from './crossmintJwt';        // New Crossmint JWT verifier
import { connectToDatabase, UserDocument } from './mongodb';
import { ObjectId } from 'mongodb';

export type HybridAuthResult =
  | { type: 'app'; user: AuthenticatedUser; source: 'cookie' }
  | { type: 'crossmint'; user: AuthenticatedUser; source: 'bearer_token'; crossmintUserId: string }
  | null;

/**
 * Attempts to authenticate a user via standard app session cookie first,
 * then falls back to a Crossmint JWT Bearer token if present.
 * Links Crossmint identity to an app user if a match is found or creates a new user.
 */
export async function getHybridUser(request: NextRequest): Promise<HybridAuthResult> {
  // 1. Try standard app session cookie
  const appUserFromCookie = getUserFromRequest(request);
  if (appUserFromCookie) {
    console.log('[HybridAuth] Authenticated via app session cookie:', appUserFromCookie.dbId);
    return { type: 'app', user: appUserFromCookie, source: 'cookie' };
  }

  // 2. No app session, try Crossmint JWT Bearer token
  const authorizationHeader = request.headers.get('authorization');
  if (!authorizationHeader || !authorizationHeader.toLowerCase().startsWith('bearer ')) {
    // console.log('[HybridAuth] No app session cookie and no Bearer token found.');
    return null;
  }

  const crossmintToken = authorizationHeader.substring(7); // Remove "Bearer " prefix
  if (!crossmintToken) {
    console.log('[HybridAuth] Bearer token found but is empty.');
    return null;
  }

  try {
    console.log('[HybridAuth] Attempting to verify Crossmint JWT...');
    const crossmintPayload = await verifyCrossmintJwt(crossmintToken);
    console.log('[HybridAuth] Crossmint JWT verified. Payload subject (crossmintUserId):', crossmintPayload.sub);

    if (!crossmintPayload.sub) {
      console.warn('[HybridAuth] Crossmint JWT verified but missing \'sub\' (crossmintUserId) claim.');
      return null;
    }

    const crossmintUserId = crossmintPayload.sub;
    // Prioritize the primary wallet if available, otherwise the first one.
    const primaryWallet = crossmintPayload.wallets?.find(w => w.primary) || crossmintPayload.wallets?.[0];

    if (!primaryWallet || !primaryWallet.address) {
      console.warn('[HybridAuth] Crossmint JWT verified but no usable wallet address found in payload.');
      return null;
    }
    const crossmintWalletAddress = primaryWallet.address;
    const crossmintWalletChain = primaryWallet.chain || 'evm'; // Default to evm if chain not present

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    let userDocument: UserDocument | null = null;

    // Try to find existing user by Crossmint User ID first, then by Crossmint Wallet Address
    if (crossmintUserId) {
      userDocument = await usersCollection.findOne({ crossmintUserId });
    }
    if (!userDocument && crossmintWalletAddress) {
      userDocument = await usersCollection.findOne({ crossmintWalletAddress });
    }

    let appUserId: ObjectId;
    let finalWalletAddressForAuthUser = crossmintWalletAddress;
    let finalChainForAuthUser = crossmintWalletChain;

    if (userDocument) {
      appUserId = userDocument._id!;
      console.log(`[HybridAuth] Found existing user (dbId: ${appUserId}) linked to Crossmint identity.`);
      // User exists, ensure Crossmint linkage fields are up-to-date
      const updateFields: Partial<UserDocument> = {};
      if (!userDocument.crossmintUserId && crossmintUserId) {
        updateFields.crossmintUserId = crossmintUserId;
      }
      if (!userDocument.crossmintWalletAddress && crossmintWalletAddress) {
        updateFields.crossmintWalletAddress = crossmintWalletAddress;
      }
      if (!userDocument.crossmintWalletChain && crossmintWalletChain) {
        updateFields.crossmintWalletChain = crossmintWalletChain;
      }
      if (Object.keys(updateFields).length > 0) {
        updateFields.updatedAt = new Date();
        await usersCollection.updateOne({ _id: appUserId }, { $set: updateFields });
        console.log(`[HybridAuth] Updated user ${appUserId} with missing Crossmint linkage fields.`);
      }
      // Prefer existing primary app walletAddress if available for the AuthenticatedUser object, 
      // but ensure the Crossmint wallet is linked.
      finalWalletAddressForAuthUser = userDocument.walletAddress || crossmintWalletAddress;
      finalChainForAuthUser = userDocument.walletChain || crossmintWalletChain;

    } else {
      // No existing user found via Crossmint ID or Wallet, create a new one
      console.log('[HybridAuth] No existing user found for Crossmint identity. Creating new user.');
      const now = new Date();
      const newUser: Partial<UserDocument> = {
        crossmintUserId,
        crossmintWalletAddress,
        crossmintWalletChain,
        // walletAddress: crossmintWalletAddress, // Set primary walletAddress to Crossmint one for new users
        // walletChain: crossmintWalletChain,
        createdAt: now,
        updatedAt: now,
        completedActions: ["crossmint_user_created"],
        // Initialize other essential fields if your UserDocument requires them
      };
      const insertResult = await usersCollection.insertOne(newUser as UserDocument);
      appUserId = insertResult.insertedId;
      console.log(`[HybridAuth] Created new user (dbId: ${appUserId}) for Crossmint identity.`);
    }

    return {
      type: 'crossmint',
      user: {
        dbId: appUserId.toHexString(),
        walletAddress: finalWalletAddressForAuthUser, // This is the address that will be used by the calling API route
        chain: finalChainForAuthUser,
      },
      source: 'bearer_token',
      crossmintUserId: crossmintUserId,
    };

  } catch (error: any) {
    console.warn('[HybridAuth] Crossmint JWT verification or DB operation failed:', error.message);
    // Avoid logging the full token in production for security
    // console.error('[HybridAuth] Failing token:', crossmintToken);
    return null;
  }
} 