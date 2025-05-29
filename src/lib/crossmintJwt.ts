import * as jose from 'jose';

// createRemoteJWKSet returns a function that resolves to the key material.
// The type for this function is ((protectedHeader?: jose.JWSHeaderParameters, token?: jose.FlattenedJWSInput) => Promise<jose.KeyLike | Uint8Array>)
// We can simplify the type annotation for jwks or let TypeScript infer it.
let jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

const CROSSMINT_ISSUER = 'https://www.crossmint.com';
// It's crucial to confirm the correct audience string from Crossmint documentation.
// Common values are 'client-sdk', your project ID, or a specific API audience.
// Using a placeholder, update if Crossmint docs specify otherwise.
const CROSSMINT_AUDIENCE = 'crossmint_api'; // Placeholder - VERIFY THIS!

/**
 * Verifies a JWT from Crossmint against their public JWKS.
 * 
 * @param token The Crossmint JWT string.
 * @returns The decoded JWT payload if verification is successful.
 * @throws Error if verification fails (e.g., invalid signature, expired, wrong issuer/audience).
 */
export async function verifyCrossmintJwt(token: string): Promise<jose.JWTPayload & { sub?: string; wallets?: { address: string; chain: string; primary?: boolean }[] }> {
  if (!jwks) {
    try {
      console.log('[CrossmintJWT] Fetching Crossmint JWKS...');
      jwks = jose.createRemoteJWKSet(new URL(`${CROSSMINT_ISSUER}/.well-known/jwks.json`));
      console.log('[CrossmintJWT] Crossmint JWKS remote set created successfully.');
    } catch (error) {
      console.error('[CrossmintJWT] Failed to create Crossmint JWKS remote set:', error);
      throw new Error('Could not create Crossmint public key set for JWT verification.');
    }
  }

  try {
    // The jwks function (from createRemoteJWKSet) is directly passed as the key argument.
    const { payload, protectedHeader } = await jose.jwtVerify(token, jwks, {
      issuer: CROSSMINT_ISSUER,
      audience: CROSSMINT_AUDIENCE,
    });
    console.log('[CrossmintJWT] JWT verified successfully. Protected Header:', protectedHeader);
    // Type assertion to include expected custom claims like `sub` and `wallets`
    return payload as jose.JWTPayload & { sub?: string; wallets?: { address: string; chain: string; primary?: boolean }[] };
  } catch (error: any) {
    console.error('[CrossmintJWT] JWT verification failed:', error.message, 'Token:', token.substring(0, 20) + "...");
    // Log more details if available from the error object, e.g., error.code for jose errors
    if (error.code) {
        console.error('[CrossmintJWT] Verification error code:', error.code);
    }
    throw error; // Re-throw the original error for the caller to handle
  }
} 