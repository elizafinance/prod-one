import মূলAirdropData from '@/data/airdropData.json';

interface AirdropGsheetEntry {
  Account: string;
  "Token Account": string; // This seems to be the token account, not directly used for lookup by main wallet
  Quantity: number | string; // The original quantity from sheet, might be string
  AIRDROP: number; // The calculated/final airdrop amount for this account
}

// Type assertion for the imported JSON
const airdropData: AirdropGsheetEntry[] = মূলAirdropData as AirdropGsheetEntry[];

// Process the airdrop data into a more usable map for quick lookups
// Key: Wallet Account (string), Value: AIRDROP amount (number)
let airdropMap: Map<string, number> | null = null;

function getAirdropMap(): Map<string, number> {
  if (airdropMap) {
    return airdropMap;
  }
  console.log('[AirdropDataUtils] Initializing airdrop data map...');
  airdropMap = new Map<string, number>();
  airdropData.forEach(entry => {
    if (entry.Account && typeof entry.AIRDROP === 'number') {
      airdropMap!.set(entry.Account, entry.AIRDROP);
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
export function getInitialDefaiForWallet(walletAddress: string | null | undefined): number | null {
  if (!walletAddress) {
    return null;
  }
  const map = getAirdropMap();
  return map.get(walletAddress) ?? null;
}

// Example of how to get all data if needed elsewhere, though typically direct lookup is better.
export function getAllAirdropData(): AirdropGsheetEntry[] {
    return airdropData;
} 