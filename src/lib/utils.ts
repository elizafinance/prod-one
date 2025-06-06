import { Token } from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a token amount or Token account into a human-readable string with proper decimal places
 * @param tokenAccountOrAmount - Either a Token object or raw bigint amount to format
 * @param decimals - Optional number of decimal places when passing raw bigint amount. Required when passing an amount.
 * @returns Formatted string with proper decimal places and thousands separators
 * @example
 * // Token account with 9 decimals and amount 1234567890
 * formatTokenAmount(tokenAccount) // Returns "1.234567890"
 * 
 * // Raw amount with 6 decimals
 * formatTokenAmount(1234567890n, 6) // Returns "1,234.567890"
 */
export function formatTokenAmount(tokenAccountOrAmount: Token | bigint, decimals?: number): string {
  if (typeof tokenAccountOrAmount === 'bigint' && !decimals) {
    throw new Error("decimals value is required when passing a raw bigint amount");
  }
  const tokenAccount = typeof tokenAccountOrAmount === 'bigint' ? { amount: tokenAccountOrAmount, header: { lamports: { decimals: decimals! } } } : tokenAccountOrAmount;
  const divisor = BigInt(10 ** tokenAccount.header.lamports.decimals);
  const whole = tokenAccount.amount / divisor;
  const remainder = tokenAccount.amount % divisor;
  
  // Pad remainder with leading zeros to match decimal places
  const remainderStr = remainder.toString().padStart(tokenAccount.header.lamports.decimals, '0');
  
  // Remove trailing zeros and add commas for cleaner display
  const formatted = `${whole.toLocaleString()}.${remainderStr}`.replace(/\.?0+$/, '');
  return formatted;
}


export const shortenAddress = (address: string, chars = 4) => {
  return address.slice(0, chars) + "..." + address.slice(-chars);
};

export const isValidPublicKey = (key: string) => {
  console.log("validating key", key);
  try {
    publicKey(key);
  } catch (error) {
    return false;
  }
  return true;
};

/**
 * Formats a number of points for display, typically using locale-specific thousands separators.
 * @param points The number of points to format.
 * @returns A string representation of the formatted points.
 */
export function formatPoints(points: number | null | undefined): string {
  if (points === null || points === undefined) {
    return '0'; // Or '-', or whatever placeholder is preferred for null/undefined points
  }
  return points.toLocaleString();
}

/**
 * Get the base URL for the application based on environment
 * Returns localhost for development, production URL for production
 * 
 * Development detection:
 * - CLIENT: NODE_ENV=development OR hostname is localhost/127.0.0.1
 * - SERVER: NODE_ENV=development
 * 
 * Port detection for development:
 * - Uses PORT or NEXT_PUBLIC_PORT environment variables
 * - Defaults to 3000 if not specified
 */
export function getBaseUrl(): string {
  // Check if we're in development or localhost
  if (typeof window !== 'undefined') {
    // Client-side
    const hostname = window.location.hostname;
    const isDev = process.env.NODE_ENV === 'development' || hostname === 'localhost' || hostname === '127.0.0.1';
    
    if (isDev) {
      return `${window.location.protocol}//${window.location.host}`;
    }
  } else {
    // Server-side
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      const port = process.env.PORT || process.env.NEXT_PUBLIC_PORT || '3000';
      return `http://localhost:${port}`;
    }
  }
  
  // Production URL
  return 'https://squad.defairewards.net';
}

/**
 * Generate a complete referral link with the appropriate base URL
 * Automatically uses localhost for development, production URL for production
 * 
 * @param referralCode - The referral code to include in the link
 * @param squadInvite - Optional squad ID for squad invitations
 * @returns Complete referral URL with proper base URL for current environment
 */
export function generateReferralLink(referralCode: string, squadInvite?: string): string {
  const baseUrl = getBaseUrl();
  let url = `${baseUrl}/?ref=${referralCode}`;
  
  if (squadInvite) {
    url += `&squadInvite=${squadInvite}`;
  }
  
  return url;
}
