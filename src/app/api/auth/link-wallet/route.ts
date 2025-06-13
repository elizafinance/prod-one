import { NextResponse, NextRequest } from 'next/server';
// import { getServerSession } from "next-auth/next"; // Replaced by getUserFromRequest
// import { authOptions } from "@/lib/auth"; 
import { connectToDatabase, UserDocument } from "@/lib/mongodb";
import { ObjectId } from 'mongodb';
import { getUserFromRequest, AuthenticatedUser } from '@/lib/authSession'; // Import the new helper
// crypto needed for randomUUID if that part of W3C VC example is used
// import crypto from 'crypto'; 

// Basic EVM-style address validation (starts with 0x, 40 hex chars)
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
// Placeholder for Solana address validation (typically Base58, 32-44 chars)
// Moved to validation utility: @/lib/validation

// --- Verifiable Credential Minting Function (Temporarily Disabled) ---
/*
async function mintAgentOwnershipVC(xUserId: string, walletAddress: string, chain: string, userDbId: string) {
  console.log(`[VC Minting] Attempting to mint Agent Ownership VC for xUserId: ${xUserId}, wallet: ${walletAddress}, chain: ${chain}`);
  
  const crossmintVcApiKey = process.env.CROSSMINT_VC_SERVICE_KEY;
  const vcApiEndpoint = process.env.CROSSMINT_VC_MINT_API_ENDPOINT;

  if (!crossmintVcApiKey || !vcApiEndpoint) {
    console.warn("[VC Minting] CROSSMINT_VC_SERVICE_KEY or CROSSMINT_VC_MINT_API_ENDPOINT is not set. Skipping real VC minting, using placeholder.");
    return { success: true, id: `vc_placeholder_misconfigured_${userDbId}_${Date.now()}` }; 
  }

  const credentialPayload = {
    type: "DefaiAgentOwnershipCredential_v1", 
    credentialSubject: {
      userId: `twitter:${xUserId}`, 
      agentWalletAddress: walletAddress,
      agentWalletChain: chain,
      platform: process.env.PLATFORM_ISSUER_DID || "did:web:your-defai-platform.com",
    },
  };

  console.log("[VC Minting] Calling Crossmint VC API Endpoint:", vcApiEndpoint);

  try {
    const response = await fetch(vcApiEndpoint, { 
      method: 'POST', 
      headers: { 
        'Authorization': `Bearer ${crossmintVcApiKey}`,
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(credentialPayload)
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[VC Minting] Crossmint VC API Error (${response.status}):`, errorBody);
      return { success: false, error: `Crossmint VC API Error (${response.status}): ${errorBody.substring(0,200)}` };
    }

    const responseData = await response.json();
    console.log("[VC Minting] Crossmint VC API Success (Raw Response):", responseData);
    const vcId = responseData.id || responseData.credentialId || responseData.transactionHash || responseData.vc?.id || responseData.credential?.id;
    if (!vcId) {
        console.error("[VC Minting] VC ID not found in Crossmint response structure:", responseData);
        return { success: false, error: "VC ID not found in Crossmint response. Check API documentation." };
    }
    return { success: true, id: vcId.toString() };

  } catch (error: any) {
    console.error("[VC Minting] Exception during VC minting API call:", error);
    return { success: false, error: error.message || "Network or unexpected error during VC minting." };
  }
}
*/
// --- END VC Minting Function ---

export async function POST(request: NextRequest) { // Changed from Request to NextRequest
  const authenticatedUser = getUserFromRequest(request);

  if (!authenticatedUser) {
    console.warn("[Link Wallet API] Authentication failed: No valid JWT auth cookie found.");
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }
  
  const { dbId: userDbIdString, walletAddress: authenticatedWalletAddress, chain: authenticatedChain } = authenticatedUser;

  let requestBody;
  try {
    requestBody = await request.json();
  } catch (error) {
    console.error("[Link Wallet API] Invalid JSON body:", error);
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { walletAddress, chain } = requestBody;

  if (!walletAddress || typeof walletAddress !== 'string') {
    return NextResponse.json({ error: 'walletAddress is required and must be a string' }, { status: 400 });
  }
  if (!chain || typeof chain !== 'string') {
    return NextResponse.json({ error: 'chain is required and must be a string' }, { status: 400 });
  }

  // Optional: Validate if the provided walletAddress and chain match the authenticated user's wallet from the JWT.
  // This depends on whether this route is intended to *change* the linked wallet or just confirm/update details for the *authenticated* wallet.
  // For now, we'll assume the request body's walletAddress and chain are the source of truth for this specific operation.
  if (walletAddress.toLowerCase() !== authenticatedWalletAddress.toLowerCase()) {
    console.warn(`[Link Wallet API] Request walletAddress ${walletAddress} differs from authenticated JWT wallet ${authenticatedWalletAddress}. Proceeding with request body's address.`);
    // Depending on security model, you might want to return an error here if they don't match.
  }
  
  let isValidAddressFormat = EVM_ADDRESS_REGEX.test(walletAddress);
  if (!isValidAddressFormat && (chain.toLowerCase().includes('solana') || chain.toLowerCase().includes('polygon') ) ){
      console.warn(`[Link Wallet API] Address ${walletAddress} on chain ${chain} is not EVM format. Assuming valid for Crossmint as it is a supported chain.`);
      isValidAddressFormat = true; 
  } else if (!isValidAddressFormat) {
    console.warn(`[Link Wallet API] Address ${walletAddress} on chain ${chain} is not valid EVM format and not recognized as other specifically handled chains.`);
    return NextResponse.json({ error: 'Invalid or unsupported walletAddress format for the specified chain.' }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const userDbId = new ObjectId(userDbIdString);

    console.log(`[Link Wallet API] User ${userDbId} (Authenticated Wallet: ${authenticatedWalletAddress}, Chain: ${authenticatedChain}) attempting to link/update wallet ${walletAddress} (chain: ${chain})`);
    const now = new Date();
    
    // --- VC Minting Temporarily Disabled --- 
    const agentOwnershipVCHash = `vc_disabled_${Date.now()}`; // Simple placeholder
    console.log("[Link Wallet API] VC Minting is temporarily disabled. Using placeholder VC ID.");
    // --- End VC Minting (Disabled) --- 

    // The primary role of wallet-login is to create the user and establish the link.
    // This route now primarily serves to ensure data consistency or update specific fields 
    // like vcAgentOwnership if it wasn't handled by wallet-login, or if it's a separate step.
    // We find the user by their dbId from the JWT.
    const result = await usersCollection.updateOne(
      { _id: userDbId }, 
      { 
        $set: { 
          walletAddress: walletAddress, // Update to the wallet address from the request body
          walletChain: chain,           // Update to the chain from the request body
          walletLinkedAt: now,        // Re-affirm or set walletLinkedAt
          vcAgentOwnership: agentOwnershipVCHash, 
          updatedAt: now
        },
        $addToSet: { completedActions: 'wallet_linked_confirmed' } // Action type changed to reflect confirmation/update
      }
    );

    if (result.matchedCount === 0) {
      // This should ideally not happen if wallet-login created the user and set the cookie correctly.
      console.error(`[Link Wallet API] User not found during update. User dbId from JWT: ${userDbIdString}`);
      return NextResponse.json({ error: 'Authenticated user not found in database.' }, { status: 404 });
    }
    
    if (result.modifiedCount === 0 && result.matchedCount === 1) {
        console.log(`[Link Wallet API] Wallet address/chain for user ${userDbIdString} likely already set or no change made.`);
    } else {
        console.log(`[Link Wallet API] Wallet ${walletAddress} (chain: ${chain}) successfully linked/updated for user ${userDbIdString}. Placeholder VC ID: ${agentOwnershipVCHash}`);
    }

    return NextResponse.json({ 
        success: true, 
        message: 'Wallet details processed successfully. (VC Minting Disabled)', 
        walletAddress: walletAddress,
        chain: chain,
        vcAgentOwnership: agentOwnershipVCHash 
    });

  } catch (error: any) {
    console.error(`[Link Wallet API] General error for user ${userDbIdString}:`, error);
    if (error.name === 'MongoServerError' && error.code === 11000) {
        console.warn(`[Link Wallet API] Duplicate key error on walletAddress: ${walletAddress}.`, error);
        // This error might still occur if another user already has this walletAddress.
        // The wallet-login route handles finding an existing user by walletAddress.
        // If this route is called, and a *different* authenticated user tries to link a wallet
        // that's already taken by *another* user, this unique index conflict can happen.
        return NextResponse.json({ error: 'This wallet address may already be linked to another account.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error while processing wallet details.' }, { status: 500 });
  }
} 