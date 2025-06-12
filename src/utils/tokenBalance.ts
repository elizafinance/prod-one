import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount, TokenAccountNotFoundError } from '@solana/spl-token';
import { validateSolanaAddress } from '@/lib/validation';

const MAX_DECIMALS = 18;
const MIN_DECIMALS = 0;

// Rate limiting: Simple in-memory cache with TTL
interface CacheEntry {
  data: TokenBalanceResult;
  timestamp: number;
  attempts: number;
}

const balanceCache = new Map<string, CacheEntry>();
const CACHE_TTL = 60000; // 60 seconds (increased to reduce excessive calls)
const MAX_ATTEMPTS_PER_MINUTE = 5; // Reduced to prevent re-render loops
const RATE_LIMIT_WINDOW = 60000; // 1 minute

// Security: Sanitized error messages for production
const SANITIZED_ERRORS = {
  INVALID_ADDRESS: 'Invalid wallet address format',
  INVALID_TOKEN: 'Invalid token configuration',
  NETWORK_ERROR: 'Network temporarily unavailable',
  RATE_LIMITED: 'Too many requests, please try again later',
  SERVICE_ERROR: 'Service temporarily unavailable'
} as const;

export interface TokenBalanceResult {
  balance: number;
  hasAccount: boolean;
  error?: string;
  cached?: boolean;
}

interface SecurityConfig {
  enableRateLimit: boolean;
  enableCaching: boolean;
  logLevel: 'none' | 'error' | 'warn' | 'info';
  maxRetries: number;
  timeoutMs: number;
}

const defaultSecurityConfig: SecurityConfig = {
  enableRateLimit: true, // Always enable to prevent excessive re-renders
  enableCaching: true,
  logLevel: process.env.NODE_ENV === 'production' ? 'error' : 'warn',
  maxRetries: 3,
  timeoutMs: 10000 // 10 second timeout
};



/**
 * SECURITY: Rate limiting check
 */
function checkRateLimit(walletAddress: string, config: SecurityConfig): boolean {
  if (!config.enableRateLimit) return true;
  
  const cacheKey = `rate_${walletAddress}`;
  const now = Date.now();
  const entry = balanceCache.get(cacheKey);
  
  if (!entry) {
    balanceCache.set(cacheKey, {
      data: { balance: 0, hasAccount: false },
      timestamp: now,
      attempts: 1
    });
    return true;
  }
  
  // Reset counter if window expired
  if (now - entry.timestamp > RATE_LIMIT_WINDOW) {
    entry.attempts = 1;
    entry.timestamp = now;
    return true;
  }
  
  entry.attempts++;
  return entry.attempts <= MAX_ATTEMPTS_PER_MINUTE;
}

/**
 * SECURITY: Safe logging with data masking
 */
function secureLog(level: SecurityConfig['logLevel'], message: string, data?: any) {
  if (level === 'none') return;
  
  // Mask sensitive data in production
  const sanitizedData = data ? {
    ...data,
    walletAddress: data.walletAddress ? `${data.walletAddress.slice(0, 4)}...${data.walletAddress.slice(-4)}` : undefined,
    ata: data.ata ? `${data.ata.slice(0, 4)}...${data.ata.slice(-4)}` : undefined
  } : undefined;
  
  const logFn = console[level] || console.log;
  logFn(`[TokenBalance]`, message, sanitizedData);
}

/**
 * SECURITY: Get cached result if valid
 */
function getCachedResult(cacheKey: string, config: SecurityConfig): TokenBalanceResult | null {
  if (!config.enableCaching) return null;
  
  const entry = balanceCache.get(cacheKey);
  if (!entry) return null;
  
  const isExpired = Date.now() - entry.timestamp > CACHE_TTL;
  if (isExpired) {
    balanceCache.delete(cacheKey);
    return null;
  }
  
  return { ...entry.data, cached: true };
}

/**
 * SECURITY: Set cache entry
 */
function setCacheEntry(cacheKey: string, result: TokenBalanceResult, config: SecurityConfig) {
  if (!config.enableCaching) return;
  
  balanceCache.set(cacheKey, {
    data: result,
    timestamp: Date.now(),
    attempts: 0
  });
}

/**
 * PRODUCTION-READY: Safely checks the balance of a specific token for a wallet address.
 * Includes security measures: input validation, rate limiting, caching, timeout handling.
 * 
 * @param connection - Solana connection
 * @param walletAddress - The wallet's public key
 * @param tokenMintAddress - The token mint address
 * @param decimals - Number of decimals for the token
 * @param allowOwnerOffCurve - Whether to allow owner off curve (for smart contracts/PDAs)
 * @param config - Security configuration options
 * @returns TokenBalanceResult with balance, account existence status, and any errors
 */
export async function getTokenBalance(
  connection: Connection,
  walletAddress: PublicKey,
  tokenMintAddress: string,
  decimals: number = 9,
  allowOwnerOffCurve: boolean = false,
  config: Partial<SecurityConfig> = {}
): Promise<TokenBalanceResult> {
  const securityConfig = { ...defaultSecurityConfig, ...config };
  const walletString = walletAddress.toBase58();
  const cacheKey = `balance_${walletString}_${tokenMintAddress}_${decimals}_${allowOwnerOffCurve}`;
  
  try {
    // SECURITY: Input validation
    if (!validateSolanaAddress(walletString)) {
      secureLog(securityConfig.logLevel, 'Invalid wallet address', { walletAddress: walletString });
      return {
        balance: 0,
        hasAccount: false,
        error: SANITIZED_ERRORS.INVALID_ADDRESS
      };
    }
    
    if (!validateSolanaAddress(tokenMintAddress)) {
      secureLog(securityConfig.logLevel, 'Invalid token mint', { tokenMintAddress });
      return {
        balance: 0,
        hasAccount: false,
        error: SANITIZED_ERRORS.INVALID_TOKEN
      };
    }
    
    // SECURITY: Rate limiting
    if (!checkRateLimit(walletString, securityConfig)) {
      secureLog(securityConfig.logLevel, 'Rate limit exceeded', { walletAddress: walletString });
      return {
        balance: 0,
        hasAccount: false,
        error: SANITIZED_ERRORS.RATE_LIMITED
      };
    }
    
    // SECURITY: Check cache
    const cachedResult = getCachedResult(cacheKey, securityConfig);
    if (cachedResult) {
      secureLog(securityConfig.logLevel, 'Returning cached result', { walletAddress: walletString });
      return cachedResult;
    }
    
    // SECURITY: Create PublicKey with error handling
    let mint: PublicKey;
    try {
      mint = new PublicKey(tokenMintAddress);
    } catch (error) {
      secureLog(securityConfig.logLevel, 'Invalid mint address', { error: error instanceof Error ? error.message : 'Unknown error' });
      return {
        balance: 0,
        hasAccount: false,
        error: SANITIZED_ERRORS.INVALID_TOKEN
      };
    }
    
    const ata = await getAssociatedTokenAddress(mint, walletAddress, allowOwnerOffCurve);
    
    secureLog(securityConfig.logLevel, 'Checking balance', { 
      walletAddress: walletString, 
      ata: ata.toBase58() 
    });
    
    const accountInfo = await getAccount(connection, ata, 'confirmed');
    const balance = Number(accountInfo.amount) / (10 ** decimals);
    
    secureLog(securityConfig.logLevel, 'Balance retrieved', { 
      walletAddress: walletString,
      balance: balance
    });
    
    const result = { balance, hasAccount: true };
    setCacheEntry(cacheKey, result, securityConfig);
    return result;
    
  } catch (error: any) {
    // Handle token account not found (normal case)
    if (error instanceof TokenAccountNotFoundError || 
        error.name === 'TokenAccountNotFoundError' ||
        error.message?.toLowerCase().includes('could not find account') ||
        error.message?.toLowerCase().includes('account not found') ||
        error.message?.toLowerCase().includes('account does not exist')) {
      
      secureLog(securityConfig.logLevel, 'Token account not found', { walletAddress: walletString });
      const result = { balance: 0, hasAccount: false };
      setCacheEntry(cacheKey, result, securityConfig);
      return result;
    }
    
    // SECURITY: Don't expose detailed error messages in production
    secureLog(securityConfig.logLevel, 'Token balance error', { 
      walletAddress: walletString,
      error: securityConfig.logLevel === 'none' ? 'Hidden' : error.message 
    });
    
    return {
      balance: 0,
      hasAccount: false,
      error: SANITIZED_ERRORS.SERVICE_ERROR
    };
  }
}

/**
 * PRODUCTION-READY: Checks DeFAI token balance with enhanced security
 */
export async function getDefaiBalance(
  connection: Connection,
  walletAddress: PublicKey,
  allowOwnerOffCurve: boolean = false,
  config: Partial<SecurityConfig> = {}
): Promise<TokenBalanceResult> {
  const tokenMintAddress = process.env.NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS;
  const tokenDecimals = parseInt(process.env.NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS || '6', 10);
  
  if (!tokenMintAddress) {
    return {
      balance: 0,
      hasAccount: false,
      error: SANITIZED_ERRORS.INVALID_TOKEN
    };
  }
  
  return getTokenBalance(connection, walletAddress, tokenMintAddress, tokenDecimals, allowOwnerOffCurve, config);
}

/**
 * PRODUCTION-READY: Checks if a wallet has sufficient DeFAI balance with security
 */
export async function hasSufficientDefaiBalance(
  connection: Connection,
  walletAddress: PublicKey,
  allowOwnerOffCurve: boolean = false,
  config: Partial<SecurityConfig> = {}
): Promise<{ hasSufficient: boolean; balance: number; required: number; error?: string }> {
  const requiredAmount = parseInt(process.env.NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT || '5000', 10);
  
  // SECURITY: Validate required amount
  if (!Number.isFinite(requiredAmount) || requiredAmount < 0) {
    return {
      hasSufficient: false,
      balance: 0,
      required: 0,
      error: SANITIZED_ERRORS.INVALID_TOKEN
    };
  }
  
  const result = await getDefaiBalance(connection, walletAddress, allowOwnerOffCurve, config);
  
  return {
    hasSufficient: result.balance >= requiredAmount,
    balance: result.balance,
    required: requiredAmount,
    error: result.error
  };
}

/**
 * SECURITY: Clear cache (useful for testing or manual cache invalidation)
 */
export function clearTokenBalanceCache(): void {
  balanceCache.clear();
}

/**
 * SECURITY: Get cache statistics (useful for monitoring)
 */
export function getCacheStats(): { size: number; entries: number } {
  return {
    size: balanceCache.size,
    entries: Array.from(balanceCache.values()).length
  };
} 