import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import BN from 'bn.js';

// Import the module under test AFTER mocks so that it uses the mocked deps
jest.mock('@project-serum/anchor', () => {
  const BN = require('bn.js');
  return {
    BN,
    // Dummy SystemProgram so file can reference programId
    web3: { SystemProgram: { programId: new PublicKey('11111111111111111111111111111111') } },
    AnchorProvider: class {},
    Program: class {
      constructor() {
        // @ts-ignore
        this.methods = {
          stake: jest.fn().mockReturnValue({
            accounts: jest.fn().mockReturnValue({
              transaction: jest.fn().mockResolvedValue(new Transaction()),
            }),
          }),
          unstake: jest.fn().mockReturnValue({
            accounts: jest.fn().mockReturnValue({
              transaction: jest.fn().mockResolvedValue(new Transaction()),
            }),
          }),
          claimRewards: jest.fn().mockReturnValue({
            accounts: jest.fn().mockReturnValue({
              transaction: jest.fn().mockResolvedValue(new Transaction()),
            }),
          }),
        } as any;
        // Mock account fetchers
        // @ts-ignore
        this.account = {
          stakeAccount: { fetchNullable: jest.fn().mockResolvedValue(null) },
          pool: { fetchNullable: jest.fn().mockResolvedValue(null) },
        } as any;
      }
    },
  };
});

jest.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: jest.fn().mockResolvedValue(new PublicKey('So11111111111111111111111111111111111111112')),
  TOKEN_PROGRAM_ID: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
}));

// Mock findProgramAddressSync used by getPositionVault util if needed
jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    PublicKey: class extends actual.PublicKey {
      static findProgramAddressSync(seeds: Buffer[], programId: any) {
        return [new actual.PublicKey('11111111111111111111111111111111'), 255];
      }
    },
  };
});

import {
  calculateEstimatedRewards,
  formatUnlockDate,
  stakeTokens,
  YIELD_PROGRAM_ID,
  LOCK_PERIODS,
} from '@/lib/yield';

// Helper wallet mock
const mockWallet = {
  publicKey: new PublicKey('7Xwjp8u2M9aRZ9ryiGeuXEt3G5ZT6ZX6xi6RwXkPZuGV'),
  signTransaction: jest.fn(async (tx: Transaction) => tx),
  signAllTransactions: jest.fn(async (txs: Transaction[]) => txs),
  sendTransaction: jest.fn(async () => 'mockSignature'),
};

describe('Yield module utility functions', () => {
  it('calculates estimated rewards correctly', () => {
    const rewards = calculateEstimatedRewards(1000, 18, 90); // 18% APY over 90 days
    // dailyRate = 0.049315..., reward = 1000 * (18/365)/100 * 90 = 4.438...
    expect(rewards).toBeCloseTo((1000 * (18 / 365) / 100) * 90, 6);
  });

  it('formats unlock date correctly', () => {
    const start = Math.floor(Date.UTC(2025, 0, 1) / 1000); // Jan 1 2025 UTC in seconds
    const formatted = formatUnlockDate(start, LOCK_PERIODS.BRONZE);
    expect(formatted).toBe('Jan 31, 2025');
  });
});

describe('Stake flow happy-path (mocked)', () => {
  it('returns signature when wallet has sendTransaction', async () => {
    const connection = new Connection('https://api.devnet.solana.com');
    const sig = await stakeTokens(connection, mockWallet as any, new BN(1000), new BN(LOCK_PERIODS.BRONZE));
    expect(sig).toBe('mockSignature');
    expect(mockWallet.sendTransaction).toHaveBeenCalled();
  });
}); 