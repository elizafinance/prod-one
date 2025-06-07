import { useState, useEffect } from 'react';

interface EnvVars {
  NEXT_PUBLIC_SOLANA_RPC_URL?: string;
  NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS?: string;
  NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT?: string;
  NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS?: string;
}

let cachedEnvVars: EnvVars | null = null;

export function useEnv() {
  const [envVars, setEnvVars] = useState<EnvVars | null>(cachedEnvVars);
  const [isLoading, setIsLoading] = useState(!cachedEnvVars);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedEnvVars) {
      return; // Already cached
    }

    const fetchEnvVars = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/config/env');
        
        if (!response.ok) {
          throw new Error(`Failed to fetch env vars: ${response.status}`);
        }

        const data = await response.json();
        cachedEnvVars = data; // Cache for subsequent calls
        setEnvVars(data);
        setError(null);
        console.log('[useEnv] Successfully loaded environment variables');
      } catch (err) {
        console.error('[useEnv] Error fetching environment variables:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEnvVars();
  }, []);

  return { envVars, isLoading, error };
}

// Utility function to get specific env var with fallback
export function getEnvVar(key: keyof EnvVars, envVars: EnvVars | null): string | undefined {
  return envVars?.[key];
} 