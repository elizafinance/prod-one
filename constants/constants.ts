import { PublicKey } from '@solana/web3.js'

export const programID = 'BrcQp4uATDgTmPHaQdvMkDn2Cui84gAkDVfBf9EQjRgi'

export const poolState = new PublicKey('6BwZP14LeJR4b3HhLRynC49BGiuJrWrc3eY6wZ3VBjy9')
export const elizaConfig = new PublicKey('DtqGvDzQfDC1aZAJJJQsemK2o2d5ao1x8EKEuAkjyhkP')
export const rewardTokenMint = new PublicKey('9L3JL9RfGWfvBwgbjEjKrdeBiMVR3UT6TzRQfThTPabi')
// export const positionMint = new PublicKey('CkmhQX5Qzk6Gy7qGqER4XMXtHeYrH/h8r5y2t5aER7E3k');
// export const positionId = new PublicKey('BKcx8vHNHoemUvf6gnHHEpQ63BvUJ2TfrDqW3G1NWr2P');
export const rewardTokenVault = new PublicKey('9uWzap2hC1RJWbCtKLjZ9DEJY68Q4YfiY5Z2YEKKZ4yN')
export const whirlpoolAddress = new PublicKey('DFH5AGc6DYvgrpm3kWXxmd5FtaBcnZMEKhQ6G784wkdv')

// export const mintTokenAddress = new PublicKey('FWcBdujAU1rCTutdRkkF58H5Vyd1ZQNyACKAdsXmqzHn')

// USDT/TRX whirlpool
export const usdtTrxWhirlpool = {
  address: new PublicKey('Eb86VWsBJLLemx4C4a3pDaMv7qtZ117ebDBrKi6G3dP1'),
  positionMint: new PublicKey('6JohkAdxtd57DUxDcVyTT3RMpp1KLJEWiNEDofnp85Cv')
};

// USDT/BTC whirlpool
export const usdtBtcWhirlpool = {
  address: new PublicKey('5CoVB3etwcPKrjPPjSUJDSxzj6DAFHa7HcPPcQ7UmsZz'),
  positionMint: new PublicKey('BgnHRF818NZVjWfcvbRWULmHAnNFikHBLJ6fRHd9tKyn')
};

// TRX/BTC whirlpool
export const trxBtcWhirlpool = {
  address: new PublicKey('9ESQwBfDGvGHBxiNkgsnGHp4fdeF9PfSkVi5Wh3sBvpD'),
  positionMint: new PublicKey('8eWJKBwFKwoSKnmB64jod7Lhtvc2t8nTbs75Dyu1oUXr')
};

// Program and config addresses
export const programId = new PublicKey('DFH5AGc6DYvgrpm3kWXxmd5FtaBcnZMEKhQ6G784wkdv');

// Staking tiers for yield farming
export const YIELD_TIERS = [
  {
    durationDays: 30,
    durationSeconds: 30 * 24 * 60 * 60, // 30 days in seconds
    lockPeriod: 30 * 24 * 60 * 60, // 30 days in seconds
    apy: "8",
    apyValue: 8
  },
  {
    durationDays: 60,
    durationSeconds: 60 * 24 * 60 * 60, // 60 days in seconds
    lockPeriod: 60 * 24 * 60 * 60, // 60 days in seconds
    apy: "12",
    apyValue: 12
  },
  {
    durationDays: 90,
    durationSeconds: 90 * 24 * 60 * 60, // 90 days in seconds
    lockPeriod: 90 * 24 * 60 * 60, // 90 days in seconds
    apy: "16",
    apyValue: 16
  }
];
