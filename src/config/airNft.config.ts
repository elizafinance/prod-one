// src/config/airNft.config.ts

export const AIR_NFT_TIERS = [
  {
    tier: 1,
    name: 'Bronze',
    bonusPct: 0.10, // 10% bonus
    cap: 3500,       // Max supply for this tier (adjusted)
    pointsPerNft: 500 // AIR points required to mint 1 NFT of this tier
  },
  {
    tier: 2,
    name: 'Silver',
    bonusPct: 0.30, // 30% bonus
    cap: 1200,
    pointsPerNft: 1500
  },
  {
    tier: 3,
    name: 'Gold',
    bonusPct: 0.50, // 50% bonus
    cap: 300,
    pointsPerNft: 3000
  },
] as const; // 'as const' provides stricter typing

/**
 * Swap fee in basis points (bps).
 * 100 bps = 1%
 */
export const SWAP_FEE_BPS = 100; // 1%

/**
 * Additional fee in basis points (bps) for accelerating vesting.
 * This fee is on top of the regular swap fee.
 */
export const ACCELERATE_FEE_BPS = 300; // 3%

/**
 * Default vesting period for swapped $DEFAI tokens, in seconds.
 * 60 * 60 * 24 * 90 = 90 days
 */
export const VESTING_SECONDS = 60 * 60 * 24 * 90;

// Ensure tiers are unique by name and tier number for safety
const tierNames = new Set();
const tierNumbers = new Set();
AIR_NFT_TIERS.forEach(tier => {
  if (tierNames.has(tier.name)) {
    throw new Error(`Duplicate tier name found: ${tier.name}`);
  }
  if (tierNumbers.has(tier.tier)) {
    throw new Error(`Duplicate tier number found: ${tier.tier}`);
  }
  tierNames.add(tier.name);
  tierNumbers.add(tier.tier);
}); 