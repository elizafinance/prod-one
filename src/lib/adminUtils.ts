/**
 * Admin Utilities for wallet address-based admin access control
 */

/**
 * Get list of admin wallet addresses from environment variable
 */
function getAdminWalletAddresses(): string[] {
  const adminWallets = process.env.ADMIN_WALLET_ADDRESSES;
  
  if (!adminWallets) {
    console.warn('[AdminUtils] ADMIN_WALLET_ADDRESSES environment variable not set');
    return [];
  }

  // Split by comma and clean up whitespace
  // Note: Keep original case for Solana addresses (base58) but normalize for comparison
  return adminWallets
    .split(',')
    .map(wallet => wallet.trim())
    .filter(wallet => wallet.length > 0);
}

/**
 * Check if a wallet address is an admin
 * Supports both Ethereum (0x...) and Solana (base58) addresses
 */
export function isAdminWallet(walletAddress: string | null | undefined): boolean {
  if (!walletAddress) {
    return false;
  }

  const adminWallets = getAdminWalletAddresses();
  const normalizedWalletAddress = walletAddress.trim();
  
  // Check if any admin wallet matches (case-insensitive for flexibility)
  return adminWallets.some(adminWallet => 
    adminWallet.toLowerCase() === normalizedWalletAddress.toLowerCase()
  );
}

/**
 * Check if a user session has admin privileges based on wallet address
 */
export function isAdminSession(session: any): boolean {
  return isAdminWallet(session?.user?.walletAddress);
}

/**
 * Check if a NextAuth token has admin privileges based on wallet address
 */
export function isAdminToken(token: any): boolean {
  return isAdminWallet(token?.walletAddress);
}

/**
 * Get admin wallets for debugging/logging (returns actual values, not lowercased)
 */
export function getAdminWalletsForDisplay(): string[] {
  const adminWallets = process.env.ADMIN_WALLET_ADDRESSES;
  
  if (!adminWallets) {
    return [];
  }

  return adminWallets
    .split(',')
    .map(wallet => wallet.trim())
    .filter(wallet => wallet.length > 0);
} 