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

export const poolState = new PublicKey('11111111111111111111111111111111');

export const usdtTrxWhirlpool = {
  positionMint: new PublicKey('11111111111111111111111111111111'),
};

// Additional placeholders required by legacy hooks
export const programID = new PublicKey('11111111111111111111111111111111');
export const rewardTokenMint = new PublicKey('11111111111111111111111111111111');
export const rewardTokenVault = new PublicKey('11111111111111111111111111111111');
export const whirlpoolAddress = new PublicKey('11111111111111111111111111111111');

// THIS NEEDS TO BE YOUR ACTUAL CONFIG ACCOUNT PUBLIC KEY
export const elizaConfig = new PublicKey('REPLACE_WITH_YOUR_ELIZA_CONFIG_PUBKEY'); 