// scripts/airdropPreview.ts
// import { connectDB } from '../src/lib/db'; // Placeholder for DB connection
// import AirSnapshot from '../src/models/AirSnapshot'; // Placeholder for AirSnapshot model
import { AIR_NFT_TIERS } from '../src/config/airNft.config';

// --- Configuration for Airdrop Calculation (Placeholders) ---
const TOTAL_AIRDROP_POOL_DEFAI = 1_000_000; // Example: 1 Million $DEFAI tokens
// This ratio defines how legacy DeFAI holdings and AIR points contribute to the share calculation.
// For simplicity, 1 legacy DeFAI token = 1 point, 1 AIR point = 1 point.
// Adjust these weights as per tokenomics decisions.
const LEGACY_DEFAI_WEIGHT = 1;
const AIR_POINTS_WEIGHT = 1;

interface UserSnapshotData {
  wallet: string;
  airPoints: number;
  legacyDefai: number;
  // avgBuyPriceUsd: number; // Could be used for more complex weighting later
  // ownedAirNfts: Array<{ tier: number; bonusPct: number }>; // For NFT bonus calculation
}

// Placeholder: Simulate fetching all user snapshot data
async function fetchAllUserSnapshots(): Promise<UserSnapshotData[]> {
  console.log('[AirdropPreview] Fetching all user snapshots (simulated)...');
  return [
    { wallet: 'WALLET_A', airPoints: 1000, legacyDefai: 50 },
    { wallet: 'WALLET_B', airPoints: 2000, legacyDefai: 100 },
    { wallet: 'WALLET_C', airPoints: 500,  legacyDefai: 0   },
    { wallet: 'WALLET_D', airPoints: 0,    legacyDefai: 20  },
    { wallet: 'WALLET_E', airPoints: 1500, legacyDefai: 10  },
  ];
}

// Placeholder: Simulate fetching NFT ownership for bonus calculation
// In a real system, this data might be part of the user snapshot or fetched separately.
async function fetchUserOwnedAirNfts(wallet: string): Promise<Array<{ tier: number; name: string; bonusPct: number }>> {
    if (wallet === 'WALLET_A') return [AIR_NFT_TIERS.find(t => t.tier === 1)!];
    if (wallet === 'WALLET_B') return [AIR_NFT_TIERS.find(t => t.tier === 2)!];
    if (wallet === 'WALLET_E') {
        const tier1 = AIR_NFT_TIERS.find(t => t.tier === 1);
        const tier3 = AIR_NFT_TIERS.find(t => t.tier === 3);
        const nfts = [];
        if (tier1) nfts.push(tier1);
        if (tier3) nfts.push(tier3);
        return nfts;
    }
    return [];
}


async function generateAirdropPreview() {
  console.log('Starting airdrop preview generation...');
  // await connectDB(); // Connect to MongoDB if fetching real data

  const allSnapshots = await fetchAllUserSnapshots();
  if (allSnapshots.length === 0) {
    console.log('No user snapshot data found to generate preview.');
    return;
  }

  let globalTotalWeightedScore = 0;
  const userScores: Array<UserSnapshotData & { weightedScore: number }> = [];

  // 1. Calculate weighted score for each user (excluding NFT bonus for now)
  for (const snapshot of allSnapshots) {
    const weightedScore = (snapshot.legacyDefai * LEGACY_DEFAI_WEIGHT) + (snapshot.airPoints * AIR_POINTS_WEIGHT);
    userScores.push({ ...snapshot, weightedScore });
    globalTotalWeightedScore += weightedScore;
  }

  if (globalTotalWeightedScore === 0) {
    console.log('Global total weighted score is 0. Cannot calculate shares.');
    return;
  }

  console.log(`Global Total Weighted Score (Legacy + AIR): ${globalTotalWeightedScore}`);
  console.log(`Total $DEFAI Airdrop Pool: ${TOTAL_AIRDROP_POOL_DEFAI.toLocaleString()}`);
  console.log('\n--- Airdrop Allocation Preview ---');
  console.log('Wallet,BaseShareScore,PctOfPool,Base$DEFAI,NFTBonus$DEFAI,Final$DEFAIAirdrop'); // CSV Header

  for (const user of userScores) {
    const shareOfPool = user.weightedScore / globalTotalWeightedScore;
    const baseDefaiAllocation = shareOfPool * TOTAL_AIRDROP_POOL_DEFAI;

    // 2. Calculate NFT bonus
    // This requires knowing which AIR NFTs each user owns and has *not* yet swapped.
    // For the preview, we'll use the simulated fetchUserOwnedAirNfts.
    const ownedNfts = await fetchUserOwnedAirNfts(user.wallet);
    let nftBonusDefai = 0;
    if (ownedNfts.length > 0) {
        // Bonus is typically applied to the $DEFAI value derived from the points that *would* be used for the NFT, 
        // or on the base airdrop itself. The interpretation from the image: "Airdrop of $DEFAI* Tier X: Y% bonus"
        // suggests the bonus is on their $DEFAI airdrop portion.
        // Let's assume the bonus applies to the baseDefaiAllocation for simplicity in this preview.
        for (const nft of ownedNfts) {
            nftBonusDefai += baseDefaiAllocation * nft.bonusPct;
        }
    }
    
    const finalDefaiAirdrop = baseDefaiAllocation + nftBonusDefai;

    console.log(
      `${user.wallet},` +
      `${user.weightedScore.toFixed(2)},` +
      `${(shareOfPool * 100).toFixed(4)}%,` +
      `${baseDefaiAllocation.toFixed(2)},` +
      `${nftBonusDefai.toFixed(2)},` +
      `${finalDefaiAirdrop.toFixed(2)}`
    );
  }

  console.log('\nNote: This preview is based on simulated data and simplified bonus logic.');
  console.log('Actual NFT ownership and bonus application rules need to be finalized.');
  // mongoose.disconnect(); // Disconnect if DB was used
}

generateAirdropPreview().catch(console.error);

// To run: ts-node ./scripts/airdropPreview.ts 