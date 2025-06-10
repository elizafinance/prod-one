/**
 * Admin Utilities for wallet address-based admin access control
 */
/**
 * Get list of admin wallet addresses from environment variable
 */
function getAdminWalletAddresses() {
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
export function isAdminWallet(walletAddress) {
    if (!walletAddress) {
        return false;
    }
    const adminWallets = getAdminWalletAddresses();
    const normalizedWalletAddress = walletAddress.trim();
    // Check if any admin wallet matches (case-insensitive for flexibility)
    return adminWallets.some(adminWallet => adminWallet.toLowerCase() === normalizedWalletAddress.toLowerCase());
}
/**
 * Check if a user session has admin privileges based on wallet address
 */
export function isAdminSession(session) {
    var _a;
    return isAdminWallet((_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.walletAddress);
}
/**
 * Check if a NextAuth token has admin privileges based on wallet address
 */
export function isAdminToken(token) {
    return isAdminWallet(token === null || token === void 0 ? void 0 : token.walletAddress);
}
/**
 * Get admin wallets for debugging/logging (returns actual values, not lowercased)
 */
export function getAdminWalletsForDisplay() {
    const adminWallets = process.env.ADMIN_WALLET_ADDRESSES;
    if (!adminWallets) {
        return [];
    }
    return adminWallets
        .split(',')
        .map(wallet => wallet.trim())
        .filter(wallet => wallet.length > 0);
}
