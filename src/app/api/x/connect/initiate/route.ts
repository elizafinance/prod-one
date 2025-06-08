import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth'; // Your NextAuth options
import crypto from 'crypto';
import { cookies } from 'next/headers';

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CALLBACK_URL = process.env.X_CALLBACK_URL;

// Helper to generate a random string for verifier and state
function generateRandomString(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

// Helper to generate PKCE code challenge
function generateCodeChallenge(verifier: string): string {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function GET(req: NextRequest) {
  if (!X_CLIENT_ID || !X_CALLBACK_URL) {
    console.error('[X Connect Initiate] X_CLIENT_ID or X_CALLBACK_URL not configured.');
    return NextResponse.json({ error: 'X integration not configured correctly on server.' }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }

  try {
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(128);
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Store state and code_verifier in httpOnly, secure cookies
    // These cookies will be sent back by the browser during the callback
    const cookieStore = cookies();
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/', // Or scope to /api/x/connect/callback if preferred
      sameSite: 'lax' as const,
      maxAge: 15 * 60, // 15 minutes in seconds
    };
    cookieStore.set('x_oauth_state', state, cookieOptions);
    cookieStore.set('x_pkce_code_verifier', codeVerifier, cookieOptions);

    const scopes = ['users.read', 'follows.read', 'tweet.read', 'offline.access']; // Added offline.access for refresh tokens
    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', X_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', X_CALLBACK_URL);
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return NextResponse.json({ authorizationUrl: authUrl.toString() });

  } catch (error: any) {
    console.error('[X Connect Initiate] Error generating X auth URL:', error);
    return NextResponse.json({ error: 'Failed to initiate X connection.', details: error.message }, { status: 500 });
  }
} 