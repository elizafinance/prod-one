import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { connectToDatabase, UserDocument } from '@/lib/mongodb';
import { encrypt } from '@/lib/encryption';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';

const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const X_CALLBACK_URL = process.env.X_CALLBACK_URL;

export async function GET(req: NextRequest) {
  if (!X_CLIENT_ID || !X_CLIENT_SECRET || !X_CALLBACK_URL) {
    console.error('[X Connect Callback] X OAuth environment variables not configured.');
    // Redirect to an error page on the frontend
    return NextResponse.redirect(new URL('/profile?x_connect_error=config', req.nextUrl.origin));
  }

  const session = await getServerSession(authOptions);
  if (!session || !session.user || !session.user.dbId) {
    console.error('[X Connect Callback] User not authenticated or dbId missing.');
    return NextResponse.redirect(new URL('/profile?x_connect_error=auth', req.nextUrl.origin));
  }

  const cookieStore = cookies();
  const storedState = cookieStore.get('x_oauth_state')?.value;
  const codeVerifier = cookieStore.get('x_pkce_code_verifier')?.value;

  // Clear cookies immediately after retrieving them
  cookieStore.delete('x_oauth_state');
  cookieStore.delete('x_pkce_code_verifier');

  if (!storedState || !codeVerifier) {
    console.error('[X Connect Callback] OAuth state or PKCE verifier missing from cookies.');
    return NextResponse.redirect(new URL('/profile?x_connect_error=missing_params', req.nextUrl.origin));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const receivedState = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    console.error(`[X Connect Callback] Error from X: ${error} - ${url.searchParams.get('error_description')}`);
    return NextResponse.redirect(new URL(`/profile?x_connect_error=${error}`, req.nextUrl.origin));
  }

  if (!code) {
    console.error('[X Connect Callback] Authorization code missing from X callback.');
    return NextResponse.redirect(new URL('/profile?x_connect_error=no_code', req.nextUrl.origin));
  }

  if (receivedState !== storedState) {
    console.error('[X Connect Callback] Invalid OAuth state. Potential CSRF attack.');
    return NextResponse.redirect(new URL('/profile?x_connect_error=state_mismatch', req.nextUrl.origin));
  }

  try {
    // 1. Exchange authorization code for tokens
    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        code: code,
        grant_type: 'authorization_code',
        client_id: X_CLIENT_ID,
        redirect_uri: X_CALLBACK_URL,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('[X Connect Callback] Failed to exchange X auth code for token:', errorData);
      throw new Error(errorData.error_description || errorData.error || 'Failed to get X token');
    }

    const tokens = await tokenResponse.json();
    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token; // Should now be present with offline.access scope
    const scopes = tokens.scope.split(' '); // Scopes granted
    
    console.log(`[X Connect Callback] Token exchange successful. Scopes: ${scopes.join(', ')}, Has refresh token: ${!!refreshToken}`);

    // 2. Fetch X user profile data (/2/users/me)
    const userProfileResponse = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      // Specify user fields to retrieve, e.g., id, username, profile_image_url
      // The URL should be like: https://api.twitter.com/2/users/me?user.fields=profile_image_url,created_at
    }); // Note: X API requires query params for user fields. Corrected below.
    
    const userProfileUrl = new URL('https://api.twitter.com/2/users/me');
    userProfileUrl.searchParams.set('user.fields', 'id,username,profile_image_url');

    const userProfileResponseCorrected = await fetch(userProfileUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
    });

    if (!userProfileResponseCorrected.ok) {
      const errorData = await userProfileResponseCorrected.json();
      console.error('[X Connect Callback] Failed to fetch X user profile:', errorData);
      throw new Error('Failed to fetch X user profile');
    }
    const xUserProfile = (await userProfileResponseCorrected.json()).data;

    // console.log("[X Callback DEBUG] xUserProfile fetched:", JSON.stringify(xUserProfile, null, 2)); // Commented out
    // console.log("[X Callback DEBUG] Storing linkedXProfileImageUrl:", xUserProfile.profile_image_url); // Commented out

    // 3. Update user document in DB
    const { db } = await connectToDatabase();
    const usersCollection = db.collection<UserDocument>('users');
    
    const updateResult = await usersCollection.updateOne(
      { _id: new ObjectId(session.user.dbId) },
      {
        $set: {
          linkedXId: xUserProfile.id,
          linkedXUsername: xUserProfile.username,
          linkedXProfileImageUrl: xUserProfile.profile_image_url,
          linkedXAccessToken: encrypt(accessToken),
          linkedXRefreshToken: refreshToken ? encrypt(refreshToken) : undefined, // Encrypt if present
          linkedXScopes: scopes,
          linkedXConnectedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    if (updateResult.matchedCount === 0) {
        console.error('[X Connect Callback] User not found in DB during update. dbId:', session.user.dbId);
        throw new Error('User not found for updating X details.');
    }

    console.log(`[X Connect Callback] Successfully linked X account ${xUserProfile.username} for user ${session.user.dbId}`);
    return NextResponse.redirect(new URL('/profile?x_connect_success=true', req.nextUrl.origin));

  } catch (error: any) {
    console.error('[X Connect Callback] General error:', error);
    return NextResponse.redirect(new URL(`/profile?x_connect_error=${error.message || 'unknown'}`, req.nextUrl.origin));
  }
} 