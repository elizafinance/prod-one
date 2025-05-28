import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth"; // Adjust path as necessary
import { connectToDatabase, UserDocument } from "@/lib/mongodb"; // Adjust path as necessary
import { ObjectId } from 'mongodb';
// crypto needed for randomUUID if that part of W3C VC example is used
// import crypto from 'crypto'; 

// Basic EVM-style address validation (starts with 0x, 40 hex chars)
const EVM_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
// Placeholder for Solana address validation (typically Base58, 32-44 chars)
// const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions) as any; 
  if (!session || !session.user || !session.user.dbId || !session.user.xId) {
    console.warn("[Link Wallet API] Authentication failed: No session, user.dbId, or user.xId missing.");
    return NextResponse.json({ error: 'User not authenticated or critical session data missing' }, { status: 401 });
  }
  // const userDbIdForVcContext = session.user.dbId; // Not needed if VC minting is disabled

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
    const userDbId = new ObjectId(session.user.dbId);

    console.log(`[Link Wallet API] User ${userDbId} (xId: ${session.user.xId}) attempting to link wallet ${walletAddress} (chain: ${chain})`);
    const now = new Date();
    
    // --- VC Minting Temporarily Disabled --- 
    const agentOwnershipVCHash = `vc_disabled_${Date.now()}`; // Simple placeholder
    console.log("[Link Wallet API] VC Minting is temporarily disabled. Using placeholder VC ID.");
    // --- End VC Minting (Disabled) --- 

    const result = await usersCollection.updateOne(
      { _id: userDbId, xId: session.user.xId }, 
      { 
        $set: { 
          walletAddress: walletAddress,
          walletChain: chain,
          walletLinkedAt: now,
          vcAgentOwnership: agentOwnershipVCHash, // Store placeholder
          updatedAt: now
        },
        $addToSet: { completedActions: 'wallet_linked' } 
      }
    );

    if (result.matchedCount === 0) {
      console.error(`[Link Wallet API] User not found or xId mismatch during update. User dbId: ${userDbId}`);
      return NextResponse.json({ error: 'User not found or xId mismatch.' }, { status: 404 });
    }
    
    if (result.modifiedCount === 0 && result.matchedCount === 1) {
        console.log(`[Link Wallet API] Wallet address/chain for user ${userDbId} likely already set.`);
    } else {
        console.log(`[Link Wallet API] Wallet ${walletAddress} (chain: ${chain}) successfully linked/updated for user ${userDbId}. Placeholder VC ID: ${agentOwnershipVCHash}`);
    }

    return NextResponse.json({ 
        success: true, 
        message: 'Wallet linked successfully. (VC Minting Disabled)', 
        walletAddress: walletAddress,
        chain: chain,
        vcAgentOwnership: agentOwnershipVCHash 
    });

  } catch (error: any) {
    console.error(`[Link Wallet API] General error linking wallet for user ${session.user.dbId}:`, error);
    if (error.name === 'MongoServerError' && error.code === 11000) {
        console.warn(`[Link Wallet API] Duplicate key error on walletAddress: ${walletAddress}.`, error);
        return NextResponse.json({ error: 'This wallet address may already be linked to another account.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal server error while linking wallet.' }, { status: 500 });
  }
} 