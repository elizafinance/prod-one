// Solana address validation utilities
const SOLANA_ADDRESS_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Validates a Solana wallet address format
 * @param address - The address string to validate
 * @returns true if the address matches Solana address format, false otherwise
 */
export function validateSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  return SOLANA_ADDRESS_PATTERN.test(address.trim());
}

/**
 * Alias for validateSolanaAddress for backward compatibility
 */
export const validateWalletAddress = validateSolanaAddress; 