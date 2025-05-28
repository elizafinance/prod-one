import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

export interface AuthenticatedUser {
  dbId: string; // Matches 'uid' in the JWT payload from wallet-login
  walletAddress: string;
  chain: string;
}

/**
 * Retrieves user information from the 'auth' JWT cookie.
 * This function is intended for use in API Routes or Edge Middleware.
 */
export function getUserFromRequest(request: NextRequest): AuthenticatedUser | null {
  const cookieStore = cookies(); // For App Router API routes
  const token = cookieStore.get('auth')?.value;

  if (!token) {
    // console.log('[AuthSession] No auth token cookie found.');
    return null;
  }

  // In development fall back to a fixed secret so local setup works out-of-the-box.
  const secret = process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev-secret' : undefined);
  if (!secret) {
    console.error('[AuthSession] NEXTAUTH_SECRET is not set. Cannot verify JWT.');
    return null; // Cannot verify without a secret
  }

  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    // console.log('[AuthSession] JWT Decoded:', decoded);

    // Ensure the payload contains the expected fields from wallet-login
    if (decoded && typeof decoded.uid === 'string' && typeof decoded.walletAddress === 'string' && typeof decoded.chain === 'string') {
      return {
        dbId: decoded.uid,
        walletAddress: decoded.walletAddress,
        chain: decoded.chain,
      };
    }
    console.warn('[AuthSession] JWT payload missing expected fields (uid, walletAddress, chain).', decoded);
    return null;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      console.log('[AuthSession] Auth token expired.');
    } else if (error.name === 'JsonWebTokenError') {
      console.warn('[AuthSession] Invalid auth token:', error.message);
    } else {
      console.error('[AuthSession] Error verifying auth token:', error);
    }
    return null;
  }
} 