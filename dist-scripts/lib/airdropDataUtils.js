import মূলAirdropData from '@/data/airdropData.json';
// Type assertion for the imported JSON
const airdropData = মূলAirdropData;
// Process the airdrop data into a more usable map for quick lookups
// Key: Wallet Account (string), Value: AIRDROP amount (number)
let airdropMap = null;
function getAirdropMap() {
    if (airdropMap) {
        return airdropMap;
    }
    console.log('[AirdropDataUtils] Initializing airdrop data map...');
    airdropMap = new Map();
    airdropData.forEach(entry => {
        if (entry.Account && typeof entry.AIRDROP === 'number') {
            airdropMap.set(entry.Account, entry.AIRDROP);
        }
    });
    console.log(`[AirdropDataUtils] Airdrop map initialized with ${airdropMap.size} entries.`);
    return airdropMap;
}
/**
 * Retrieves the initial DeFAI airdrop amount for a given wallet address.
 * @param walletAddress The wallet address to look up.
 * @returns The airdrop amount (number) or null if not found.
 */
export function getInitialDefaiForWallet(walletAddress) {
    var _a;
    if (!walletAddress) {
        return null;
    }
    const map = getAirdropMap();
    return (_a = map.get(walletAddress)) !== null && _a !== void 0 ? _a : null;
}
// Example of how to get all data if needed elsewhere, though typically direct lookup is better.
export function getAllAirdropData() {
    return airdropData;
}
