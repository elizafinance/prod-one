/**
 * Utility to check if required environment variables are set
 * Now works with API-fetched environment variables to bypass Next.js bundling issues
 */

interface EnvVars {
  NEXT_PUBLIC_SOLANA_RPC_URL?: string;
  NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS?: string;
  NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT?: string;
  NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS?: string;
}

export function checkRequiredEnvVars(envVars?: EnvVars | null): boolean {
  // Skip check during server-side rendering
  if (typeof window === 'undefined') {
    return true; // Always pass on server-side
  }

  // If no envVars provided, we can't check yet
  if (!envVars) {
    console.log('[checkEnv] Environment variables not loaded yet, skipping check');
    return true;
  }

  const requiredVars: (keyof EnvVars)[] = [
    'NEXT_PUBLIC_SOLANA_RPC_URL',
    'NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS',
    'NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT',
  ];

  const missingVars = requiredVars.filter(
    (varName) => !envVars[varName]
  );

  if (missingVars.length > 0) {
    console.error('Missing required environment variables:');
    missingVars.forEach((varName) => {
      console.error(`- ${varName}`);
    });
    console.log('[DEBUG] Available env vars:', Object.keys(envVars));
    return false;
  }

  console.log('All required environment variables are set:');
  requiredVars.forEach((varName) => {
    // Mask sensitive values for security
    const value = envVars[varName];
    const maskedValue = value 
      ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}` 
      : 'undefined';
    console.log(`- ${varName}: ${maskedValue}`);
  });
  return true;
}

// Legacy function for backward compatibility (will always return true now)
export function checkRequiredEnvVarsLegacy(): boolean {
  console.warn('[checkEnv] Using legacy checkRequiredEnvVars - consider upgrading to API-based approach');
  return true;
} 