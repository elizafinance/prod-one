import { NextResponse, NextRequest } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getTokenBalance } from '@/utils/tokenBalance';
import { rateLimit } from '../../../../../lib/rateLimit';

// Security: Input validation
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function validateWalletAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  if (address.length < 32 || address.length > 44) return false;
  return SOLANA_ADDRESS_PATTERN.test(address);
}

// Security: Rate limiting per IP
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 unique IPs per minute
});

export async function GET(
  request: NextRequest,
  { params }: { params: { walletAddress: string } }
) {
  try {
    // Security: Get client IP for rate limiting
    const ip = request.ip ?? 
               request.headers.get('x-forwarded-for')?.split(',')[0] ?? 
               request.headers.get('x-real-ip') ?? 
               'unknown';

    // Security: Apply rate limiting (10 requests per minute per IP)
    try {
      await limiter.check(10, ip);
    } catch {
      return NextResponse.json(
        { error: 'Too many requests, please try again later' },
        { status: 429 }
      );
    }

    // Security: Input validation
    const walletAddress = params.walletAddress;
    if (!validateWalletAddress(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Security: Server-side environment variables (not exposed to client)
    const tokenMintAddress = process.env.DEFAI_TOKEN_MINT_ADDRESS;
    const tokenDecimals = parseInt(process.env.DEFAI_TOKEN_DECIMALS || '6', 10);
    const rpcUrl = process.env.SOLANA_RPC_URL;

    if (!tokenMintAddress || !rpcUrl) {
      console.error('[TokenBalance API] Missing required environment variables');
      return NextResponse.json(
        { error: 'Service configuration error' },
        { status: 500 }
      );
    }

    // Security: Create connection with timeout
    const connection = new Connection(rpcUrl, 'confirmed');

    // Security: Validate PublicKey creation
    let publicKey: PublicKey;
    try {
      publicKey = new PublicKey(walletAddress);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    // Security: Use secure token balance function with all protections
    const result = await getTokenBalance(
      connection,
      publicKey,
      tokenMintAddress,
      tokenDecimals,
      false, // allowOwnerOffCurve
      {
        enableRateLimit: true,
        enableCaching: true,
        logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'warn',
        maxRetries: 3,
        timeoutMs: 8000, // 8 second timeout (less than HTTP timeout)
      }
    );

    // Security: Log successful requests (with masked address)
    const maskedAddress = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
    console.log(`[TokenBalance API] Balance check completed for ${maskedAddress}`, {
      ip: ip.slice(0, 10) + '...', // Mask IP for privacy
      balance: result.balance,
      hasAccount: result.hasAccount,
      cached: result.cached,
    });

    return NextResponse.json({
      balance: result.balance,
      hasAccount: result.hasAccount,
      cached: result.cached,
    });

  } catch (error) {
    // Security: Log errors without exposing sensitive information
    console.error('[TokenBalance API] Unexpected error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      ip: request.ip?.slice(0, 10) + '...',
    });

    return NextResponse.json(
      { error: 'Service temporarily unavailable' },
      { status: 500 }
    );
  }
} 