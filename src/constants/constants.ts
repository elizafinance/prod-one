import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export const YIELD_TIERS = [
  {
    name: 'Bronze',
    apy: '12%',
    apyValue: 12,
    durationSeconds: 30 * 24 * 60 * 60,
  },
];

// Program and config addresses
export const ELIZA_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_ELIZA_PROGRAM_ID || '11111111111111111111111111111111');
export const REWARD_TOKEN_MINT = new PublicKey(process.env.NEXT_PUBLIC_REWARD_TOKEN_MINT || 'So11111111111111111111111111111111111111112');
export const YIELD_PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_YIELD_PROGRAM_ID || '11111111111111111111111111111111');
export const AIR_TOKEN_MINT = new PublicKey(process.env.NEXT_PUBLIC_AIR_TOKEN_MINT || 'So11111111111111111111111111111111111111112');

// Pool state
export const poolState = new PublicKey(process.env.NEXT_PUBLIC_POOL_STATE || '11111111111111111111111111111111');

// Whirlpool addresses
export const USDT_TRX_WHIRLPOOL_ADDRESS = new PublicKey(process.env.NEXT_PUBLIC_USDT_TRX_WHIRLPOOL_ADDRESS || '11111111111111111111111111111111');
export const USDT_BTC_WHIRLPOOL_ADDRESS = new PublicKey(process.env.NEXT_PUBLIC_USDT_BTC_WHIRLPOOL_ADDRESS || '11111111111111111111111111111111');
export const TRX_BTC_WHIRLPOOL_ADDRESS = new PublicKey(process.env.NEXT_PUBLIC_TRX_BTC_WHIRLPOOL_ADDRESS || '11111111111111111111111111111111');

// Whirlpool configurations
export const usdtTrxWhirlpool = {
  positionMint: USDT_TRX_WHIRLPOOL_ADDRESS,
};

export const usdtBtcWhirlpool = {
  positionMint: USDT_BTC_WHIRLPOOL_ADDRESS,
};

export const trxBtcWhirlpool = {
  positionMint: TRX_BTC_WHIRLPOOL_ADDRESS,
};

// Exports for backward compatibility
export const programId = ELIZA_PROGRAM_ID;
export const rewardTokenMint = REWARD_TOKEN_MINT;
export const elizaConfig = ELIZA_PROGRAM_ID; 