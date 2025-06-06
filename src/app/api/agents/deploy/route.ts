import { NextResponse, NextRequest } from 'next/server';
import { getHybridUser, HybridAuthResult } from '@/lib/hybridAuth';
import { connectToDatabase, UserDocument } from "@/lib/mongodb";
import { ObjectId } from 'mongodb';
import { exec } from 'child_process'; // For calling Fleek CLI
import util from 'util';

// Solana-specific imports for token balance check
import { Connection, PublicKey, clusterApiUrl, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

const execPromise = util.promisify(exec); // Promisify exec for async/await

// This should ideally be in a shared types definition file
// interface UserDocument {
//   _id: ObjectId;
//   xUserId: string;
//   walletAddress?: string;
//   agentId?: string; // ID of the deployed agent (e.g., Fleek function ID or internal ID)
//   agentStatus?: 'PENDING' | 'DEPLOYING' | 'RUNNING' | 'FAILED' | 'ARCHIVED';
//   agentDeployedAt?: Date;
//   // ... other fields
// }

// --- Actual Solana DEFAI Token Balance Check ---
async function getDefaiTokenBalance(walletAddress: string): Promise<number> {
  console.log(`[Staking Check] Attempting to fetch DEFAI token balance for wallet: ${walletAddress}`);

  const rpcUrl = process.env.SOLANA_RPC_URL;
  const defaiMintAddress = process.env.DEFAI_TOKEN_MINT_ADDRESS;
  const defaiDecimalsStr = process.env.DEFAI_TOKEN_DECIMALS;

  if (!rpcUrl) {
    console.error("[Staking Check] Error: SOLANA_RPC_URL environment variable is not set.");
    return 0; // Or throw an error to indicate configuration issue
  }
  if (!defaiMintAddress) {
    console.error("[Staking Check] Error: DEFAI_TOKEN_MINT_ADDRESS environment variable is not set.");
    return 0; 
  }
  if (!defaiDecimalsStr || isNaN(parseInt(defaiDecimalsStr))) {
    console.error("[Staking Check] Error: DEFAI_TOKEN_DECIMALS environment variable is not set or is not a valid number.");
    return 0; 
  }
  const defaiDecimals = parseInt(defaiDecimalsStr);

  try {
    const connection = new Connection(rpcUrl, 'confirmed');
    const userPublicKey = new PublicKey(walletAddress);
    const defaiTokenMint = new PublicKey(defaiMintAddress);
    
    // Get the associated token account address for the user's wallet and the DEFAI token mint
    const associatedTokenAccountAddress = await getAssociatedTokenAddress(
      defaiTokenMint,
      userPublicKey,
      false // allowOwnerOffCurve - typically false for user ATAs
    );

    console.log(`[Staking Check] DEFAI Associated Token Account for ${walletAddress}: ${associatedTokenAccountAddress.toBase58()}`);

    // Fetch the account info for the ATA
    const accountInfo = await getAccount(connection, associatedTokenAccountAddress, 'confirmed');
    
    // Amount is a BigInt, convert to number and adjust for decimals
    const balance = Number(accountInfo.amount) / (10 ** defaiDecimals);
    
    console.log(`[Staking Check] Wallet ${walletAddress} has ${balance} DEFAI.`);
    return balance;

  } catch (error: any) {
    console.error(`[Staking Check] Error fetching DEFAI balance for ${walletAddress} (Mint: ${defaiMintAddress}):`, error.message);
    // Common errors: 
    // - Account not found (TokenAccountNotFoundError from spl-token, or if getAccount throws similarly for non-existent ATAs)
    // - Invalid public key string for walletAddress or defaiMintAddress
    // - RPC connection issues
    // If the ATA does not exist, it means the user has 0 balance of this token.
    // The getAccount function will throw an error if the account does not exist.
    if (error.name === 'TokenAccountNotFoundError' || 
        (error.message && (error.message.toLowerCase().includes('could not find account') || 
                           error.message.toLowerCase().includes('invalid public key') ||
                           error.message.toLowerCase().includes('account does not exist')))) {
      console.log(`[Staking Check] DEFAI ATA for ${walletAddress} not found or error suggests zero balance.`);
      return 0; 
    }
    
    // For other types of errors (e.g., RPC issues, unexpected errors), 
    // re-throwing or returning a specific error code might be better than returning 0,
    // as it could incorrectly deny deployment due to a temporary network glitch.
    // For now, returning 0 for any error to ensure the flow continues, but this should be made robust.
    console.error("[Staking Check] Unhandled error type during balance check, returning 0 as fallback:", error);
    return 0; 
  }
}
// --- End Staking Check ---

// Helper function to execute Fleek CLI commands
async function executeFleekCommand(commandArgs: string): Promise<{ stdout: string, stderr: string, success: boolean, error?: any, deployedUrl?: string }> {
  const fleekApiKey = process.env.FLEEK_API_KEY; // Ensure this is a SERVER-SIDE variable
  if (!fleekApiKey) {
    const errMsg = "FLEEK_API_KEY environment variable is not set. Cannot execute Fleek CLI.";
    console.error(`[Fleek Deploy] ${errMsg}`);
    return { stdout: '', stderr: errMsg, success: false, error: new Error(errMsg) };
  }

  // ** USER ACTION REQUIRED: Verify/Modify Fleek CLI Authentication Method **
  // This example assumes the Fleek CLI uses an environment variable FLEEK_TOKEN for auth.
  // Adjust if your CLI uses a different variable, a global flag (e.g., `fleek --token ${fleekApiKey} ...`),
  // or relies on a pre-login/config setup.
  const authenticatedFleekCommand = `FLEEK_TOKEN=${fleekApiKey} fleek ${commandArgs}`;
  
  console.log("[Fleek Deploy] Preparing to execute Fleek CLI.");
  // Avoid logging the full command if `commandArgs` could inadvertently contain sensitive info not from env vars.
  // console.log(`[Fleek Deploy] Executing: ${authenticatedFleekCommand}`); 

  try {
    console.log("[Fleek Deploy] Executing Fleek CLI command... (Details may be redacted for security)");
    const { stdout, stderr } = await execPromise(authenticatedFleekCommand);

    let success = true; // Assume success unless specific error patterns are found in stderr

    if (stderr) {
      console.warn("[Fleek Deploy] Fleek CLI command produced stderr output:");
      stderr.split('\n').forEach(line => console.warn(`[Fleek Stderr] ${line}`));
      // ** USER ACTION REQUIRED: Determine if specific stderr messages indicate a non-fatal warning vs. a true failure **
      // For example, if stderr contains "Error:" or "Failed", set success = false;
      if (stderr.toLowerCase().includes('error:') || stderr.toLowerCase().includes('failed')) {
        console.error("[Fleek Deploy] Detected error keywords in stderr. Marking as failure.");
        success = false;
      }
    }
    if (stdout) {
        console.log("[Fleek Deploy] Fleek CLI command produced stdout output:");
        stdout.split('\n').forEach(line => console.log(`[Fleek Stdout] ${line}`));
    }

    if (!success) { // If stderr indicated failure
        return { stdout, stderr, success: false, error: new Error(`Fleek CLI reported failure in stderr: ${stderr.substring(0, 200)}`) };
    }

    // ** USER ACTION REQUIRED: Parse `stdout` to reliably extract the deployed URL. **
    // The regex below are common patterns but MUST be verified against your actual Fleek CLI output.
    const urlPatterns = [
        /Live URL: (https?:\/\/[^\s]+)/i,
        /Service URL: (https?:\/\/[^\s]+)/i,
        /Site deployed: (https?:\/\/[^\s]+)/i,
        /Endpoint: (https?:\/\/[^\s]+)/i, // Another common pattern
        /(https?:\/\/[a-zA-Z0-9\-]+(?:\.on-fleek\.app|\.fleek\.co)(?:\/[^\s]*)?)/i // More generic Fleek URL
    ];
    let deployedUrl: string | undefined = undefined;
    for (const pattern of urlPatterns) {
        const match = stdout.match(pattern);
        if (match && match[1]) {
            deployedUrl = match[1];
            console.log(`[Fleek Deploy] Parsed Deployed URL: ${deployedUrl}`);
            break;
        }
    }

    if (!deployedUrl) {
        console.warn("[Fleek Deploy] Could not automatically parse deployment URL from Fleek CLI stdout. Please check Fleek dashboard or CLI output manually.");
        // Depending on your requirements, you might mark this as a partial success or a failure if URL is critical.
        // For now, let's consider it a success if the command didn't error, but URL needs manual check.
    }
    
    return { stdout, stderr, success: true, deployedUrl };

  } catch (error: any) {
    console.error("[Fleek Deploy] Critical error executing Fleek CLI command:");
    if (error.stderr) { console.error("[Fleek Exec Stderr]:"); error.stderr.split('\n').forEach((line: string) => console.error(`[Fleek Stderr] ${line}`));}
    if (error.stdout) { console.error("[Fleek Exec Stdout]:"); error.stdout.split('\n').forEach((line: string) => console.error(`[Fleek Stdout] ${line}`));}
    console.error("[Fleek Exec Error Obj]:"); console.error(error);
    return { stdout: error.stdout || '', stderr: error.stderr || error.message || 'Unknown CLI execution error', success: false, error };
  }
}

export async function POST(request: NextRequest) {
  const hybridAuthResult = await getHybridUser(request);
  let userForCatchBlock: Partial<UserDocument> & { _id?: ObjectId } | null = null;

  if (!hybridAuthResult) {
    console.warn("[Agent Deploy API] Auth failed: No valid session cookie or Crossmint JWT found.");
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }
  
  const authenticatedUser = hybridAuthResult.user;
  const { dbId: userDbIdString, walletAddress: userWalletAddressFromJwt, chain: userWalletChainFromJwt } = authenticatedUser;

  try {
    const STAKING_REQUIREMENT = 1000000; 
    const userDefaiBalance = await getDefaiTokenBalance(userWalletAddressFromJwt);
    if (userDefaiBalance < STAKING_REQUIREMENT) {
      console.warn(`[Agent Deploy API] User ${userDbIdString} (Wallet: ${userWalletAddressFromJwt}) does not meet staking requirement.`);
      return NextResponse.json({ 
        error: `Staking requirement not met. Min ${STAKING_REQUIREMENT.toLocaleString()} DEFAI needed.`,
        details: { required: STAKING_REQUIREMENT, current: userDefaiBalance }
      }, { status: 403 });
    }
    console.log(`[Agent Deploy API] User ${userDbIdString} (Wallet: ${userWalletAddressFromJwt}) meets staking requirement.`);

    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    const userDbId = new ObjectId(userDbIdString);
    const user = await usersCollection.findOne({ _id: userDbId }); 
    userForCatchBlock = user; 

    if (!user) {
      console.error(`[Agent Deploy API] Authenticated user not found in DB with dbId: ${userDbIdString}`);
      return NextResponse.json({ error: 'Authenticated user not found' }, { status: 404 });
    }

    // Ensure user has critical wallet info; wallet-login and link-wallet should have set this.
    if (!user.walletAddress || !user.walletChain) {
      console.error(`[Agent Deploy API] User ${userDbIdString} is missing walletAddress or walletChain in DB. Wallet must be fully linked.`);
      return NextResponse.json({ error: 'User wallet information incomplete. Please ensure wallet is linked.' }, { status: 400 });
    }

    if (user.agentId && user.agentStatus === 'RUNNING') {
      console.log(`[Agent Deploy API] Agent for user ${userDbIdString} is already RUNNING.`);
      return NextResponse.json({ 
        success: true, message: `Agent is already RUNNING.`, 
        agentId: user.agentId, status: user.agentStatus,
        agentDeployedAt: user.agentDeployedAt, agentUrl: user.agentUrl
      });
    }
    
    const agentId = user.agentId || `defai_agent_prod_${userDbId.toHexString()}`;    
    const agentType = 'generic_v1'; 
    let agentDeployedAt = user.agentDeployedAt || new Date();
    let agentUrl = user.agentUrl; 
    let agentStatus = user.agentStatus || 'PENDING';

    console.log(`[Agent Deploy API] Preparing agent deployment for user ${userDbIdString}.`);
    
    const agentSiteName = `defai-agent-${userDbId.toHexString()}`; 
    const agentTemplatePath = process.env.FLEEK_AGENT_TEMPLATE_PATH || "./default-fleek-agent-template";
    
    const agentEnvVars = [
        `USER_DB_ID=${userDbId.toHexString()}`,
        `AGENT_ID=${agentId}`,
        `AGENT_WALLET_ADDRESS=${user.walletAddress || 'MISSING_WALLET'}`,
        `AGENT_WALLET_CHAIN=${user.walletChain || 'UNKNOWN_CHAIN'}`,
    ];
    const envStringForCli = agentEnvVars.map(v => { 
        const parts = v.split('='); 
        const key = parts[0]; 
        const value = parts.slice(1).join('='); 
        return `--env ${key}=${JSON.stringify(value)}`;
    }).join(' ');

    let fleekDeployCommandArgs = `site:create --name "${agentSiteName}" --template "${agentTemplatePath}" ${envStringForCli}`;
    
    console.log(`[Agent Deploy API] Intended Fleek CLI arguments: ${fleekDeployCommandArgs}`);
    await usersCollection.updateOne( { _id: userDbId }, { $set: { agentStatus: 'DEPLOYING', agentId: agentId, agentType: agentType, updatedAt: new Date() } } );
    
    const deployResult = await executeFleekCommand(fleekDeployCommandArgs);

    if (deployResult.success) {
      const urlMatch = deployResult.stdout.match(/Live URL: (https?:\/\/[^\s]+)/i) || 
                       deployResult.stdout.match(/Service URL: (https?:\/\/[^\s]+)/i) ||
                       deployResult.stdout.match(/Site deployed: (https?:\/\/[^\s]+)/i);
      
      agentUrl = urlMatch ? urlMatch[1] : `https://check-fleek-dashboard-for-${agentSiteName}`; 
      agentStatus = 'RUNNING';
      agentDeployedAt = new Date();
      console.log(`[Agent Deploy API] Fleek deployment reported success for ${agentSiteName}. Tentative URL: ${agentUrl}`);
      if (!urlMatch) {
        console.warn("[Agent Deploy API] Could not automatically parse deployment URL from Fleek CLI stdout. Please check Fleek dashboard.");
      }
    } else {
      agentStatus = 'FAILED';
      console.error(`[Agent Deploy API] Fleek deployment failed for ${agentSiteName}. Stderr: ${deployResult.stderr || 'Unknown CLI error'}`);
    }

    await usersCollection.updateOne(
      { _id: userDbId },
      {
        $set: {
          agentId: agentId, agentType: agentType, agentStatus: agentStatus,
          agentUrl: agentUrl, agentDeployedAt: agentDeployedAt, updatedAt: new Date()
        },
        $addToSet: { completedActions: agentStatus === 'RUNNING' ? 'agent_deployment_successful' : 'agent_deployment_failed' } 
      }
    );
    
    if (!deployResult.success) {
        return NextResponse.json({ error: `Agent deployment failed: ${deployResult.stderr || 'Unknown CLI error'}` }, { status: 500 });
    }

    console.log(`[Agent Deploy API] Agent for user ${userDbIdString} status: ${agentStatus}.`);
    return NextResponse.json({
      success: true, message: `Agent deployment ${agentStatus === 'RUNNING' ? 'successful' : 'failed but status updated'}.`,
      agentId: agentId, status: agentStatus, agentType: agentType,
      agentUrl: agentUrl, deployedAt: agentDeployedAt.toISOString()
    });

  } catch (error: any) {
    console.error("[Agent Deploy API] Outer error deploying agent:", error);
    // Use userDbIdString from JWT if available, otherwise try to get from userForCatchBlock if it was populated.
    const finalUserDbIdString = userDbIdString || userForCatchBlock?._id?.toHexString();
    if (finalUserDbIdString) {
      try {
          const userDbIdForErrorUpdate = new ObjectId(finalUserDbIdString);
          const { db } = await connectToDatabase();
          const usersCollection = db.collection<UserDocument>('users');
          // Ensure agentId is set, even if it's a fallback, to prevent it from being undefined in the DB
          const agentIdToSet = userForCatchBlock?.agentId || `defai_agent_prod_${finalUserDbIdString}_outer_fail`;
          await usersCollection.updateOne({_id: userDbIdForErrorUpdate}, {$set: {agentStatus: 'FAILED', updatedAt: new Date(), agentId: agentIdToSet}});
      } catch (dbError) {
          console.error(`[Agent Deploy API] Failed to update agent status to FAILED for user ${finalUserDbIdString} on outer error:`, dbError);
      }
    } else {
      console.error("[Agent Deploy API] Could not determine user ID to update agent status to FAILED on outer error.");
    }
    return NextResponse.json({ error: 'Internal server error during agent deployment process.' }, { status: 500 });
  }
} 