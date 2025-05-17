import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, web3 } from '@project-serum/anchor';
import BN from 'bn.js';
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import idl from '@/idl/yield_program.json';

// Define a wallet adapter interface matching Anchor's requirements
interface WalletAdapter {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
  sendTransaction?: (tx: Transaction, connection?: Connection) => Promise<string>;
}

// Anchor wallet for read-only operations
interface ReadOnlyWallet {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
}

// Define types for staking account and pool
interface StakeAccount {
  owner: PublicKey;
  pool: PublicKey;
  amount: BN;
  lockPeriod: BN;
  startTime: BN;
  rewardDebt: BN;
  rewardsEarned: BN;
  rewardMultiplier: BN;
}

interface Pool {
  authority: PublicKey;
  tokenMint: PublicKey;
  tokenVault: PublicKey;
  rewardRate: BN;
  totalStaked: BN;
  lastUpdateTime: BN;
}

// Program ID for the yield program
export const YIELD_PROGRAM_ID = new PublicKey('vz3uzUGLjokzqNX98LjCZXhykeK5wrkKjQrPScUcuUF');
export const AIR_TOKEN_MINT = new PublicKey('So11111111111111111111111111111111111111112');

// Lock period definitions in seconds
export const LOCK_PERIODS = {
  BRONZE: 30 * 24 * 60 * 60, // 30 days
  SILVER: 90 * 24 * 60 * 60, // 90 days
  GOLD: 180 * 24 * 60 * 60, // 180 days
  DIAMOND: 365 * 24 * 60 * 60, // 365 days
};

export const REWARD_MULTIPLIERS = {
  BRONZE: new BN(15), // 1.5x multiplier (using 10 as base)
  SILVER: new BN(20), // 2.0x multiplier
  GOLD: new BN(30), // 3.0x multiplier
  DIAMOND: new BN(50), // 5.0x multiplier
};

export const YIELD_TIERS = [
  {
    name: "Bronze",
    duration: "30 Days Lock",
    durationDays: 30,
    apy: "12%",
    apyValue: 12,
    multiplier: 1.5,
    recommended: false,
    lockPeriod: LOCK_PERIODS.BRONZE,
    rewardMultiplier: REWARD_MULTIPLIERS.BRONZE,
    benefits: [
      "Base reward rate",
      "Early withdrawal option (with penalty)",
      "No minimum deposit"
    ]
  },
  {
    name: "Silver",
    duration: "90 Days Lock",
    durationDays: 90,
    apy: "18%",
    apyValue: 18,
    multiplier: 2.0,
    recommended: false,
    lockPeriod: LOCK_PERIODS.SILVER,
    rewardMultiplier: REWARD_MULTIPLIERS.SILVER,
    benefits: [
      "2x reward multiplier",
      "Governance voting rights",
      "Reduced fees"
    ]
  },
  {
    name: "Gold",
    duration: "180 Days Lock",
    durationDays: 180,
    apy: "25%",
    apyValue: 25,
    multiplier: 3.0,
    recommended: true,
    lockPeriod: LOCK_PERIODS.GOLD,
    rewardMultiplier: REWARD_MULTIPLIERS.GOLD,
    benefits: [
      "3x reward multiplier",
      "Premium governance rights",
      "Priority access to new features",
      "Fee reductions"
    ]
  },
  {
    name: "Diamond",
    duration: "365 Days Lock",
    durationDays: 365,
    apy: "40%",
    apyValue: 40,
    multiplier: 5.0,
    recommended: false,
    lockPeriod: LOCK_PERIODS.DIAMOND,
    rewardMultiplier: REWARD_MULTIPLIERS.DIAMOND,
    benefits: [
      "5x reward multiplier",
      "Maximum governance weight",
      "Zero platform fees",
      "Exclusive airdrops"
    ]
  }
];

// Get the yield program
export function getYieldProgram(connection: Connection, wallet: WalletAdapter) {
  const provider = new AnchorProvider(
    connection,
    wallet,
    { commitment: 'processed' }
  );
  
  // @ts-ignore: The JSON import shape isn't fully typed for Anchor's Program constructor
  return new Program(idl, YIELD_PROGRAM_ID, provider);
}

// Find the pool address
export async function findPoolAddress() {
  const [poolAddress] = await PublicKey.findProgramAddress(
    [Buffer.from('pool'), AIR_TOKEN_MINT.toBuffer()],
    YIELD_PROGRAM_ID
  );
  return poolAddress;
}

// Find the token vault address
export async function findTokenVaultAddress() {
  const [vaultAddress] = await PublicKey.findProgramAddress(
    [Buffer.from('vault'), AIR_TOKEN_MINT.toBuffer()],
    YIELD_PROGRAM_ID
  );
  return vaultAddress;
}

// Find a user's stake account
export async function findStakeAccount(walletAddress: PublicKey) {
  const poolAddress = await findPoolAddress();
  
  const [stakeAccount] = await PublicKey.findProgramAddress(
    [Buffer.from('stake'), poolAddress.toBuffer(), walletAddress.toBuffer()],
    YIELD_PROGRAM_ID
  );
  
  return stakeAccount;
}

// Stake tokens
export async function stakeTokens(
  connection: Connection,
  wallet: WalletAdapter,
  amount: BN,
  lockPeriod: BN
) {
  const program = getYieldProgram(connection, wallet);
  const poolAddress = await findPoolAddress();
  const tokenVault = await findTokenVaultAddress();
  const stakeAccount = await findStakeAccount(wallet.publicKey);
  
  // Get the associated token account for the user's wallet
  const stakerTokenAccount = await getAssociatedTokenAddress(
    AIR_TOKEN_MINT,
    wallet.publicKey
  );
  
  // Create transaction
  const tx = await (program as any).methods
    .stake(amount, lockPeriod)
    .accounts({
      pool: poolAddress,
      stakeAccount,
      staker: wallet.publicKey,
      tokenVault,
      stakerTokenAccount,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();
  
  // Sign and send transaction
  if (wallet.sendTransaction) {
    return await wallet.sendTransaction(tx);
  }
  
  // Fallback to sign + send manually
  const signedTx = await wallet.signTransaction(tx);
  const serializedTx = signedTx.serialize();
  const signature = await connection.sendRawTransaction(serializedTx);
  return signature;
}

// Unstake tokens
export async function unstakeTokens(connection: Connection, wallet: WalletAdapter) {
  const program = getYieldProgram(connection, wallet);
  const poolAddress = await findPoolAddress();
  const tokenVault = await findTokenVaultAddress();
  const stakeAccount = await findStakeAccount(wallet.publicKey);
  
  // Get the associated token account for the user's wallet
  const stakerTokenAccount = await getAssociatedTokenAddress(
    AIR_TOKEN_MINT,
    wallet.publicKey
  );
  
  // Create transaction
  const tx = await (program as any).methods
    .unstake()
    .accounts({
      pool: poolAddress,
      stakeAccount,
      staker: wallet.publicKey,
      tokenVault,
      stakerTokenAccount,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();
  
  // Sign and send transaction
  if (wallet.sendTransaction) {
    return await wallet.sendTransaction(tx);
  }
  
  // Fallback to sign + send manually
  const signedTx = await wallet.signTransaction(tx);
  const serializedTx = signedTx.serialize();
  const signature = await connection.sendRawTransaction(serializedTx);
  return signature;
}

// Claim rewards
export async function claimRewards(connection: Connection, wallet: WalletAdapter) {
  const program = getYieldProgram(connection, wallet);
  const poolAddress = await findPoolAddress();
  const tokenVault = await findTokenVaultAddress();
  const stakeAccount = await findStakeAccount(wallet.publicKey);
  
  // Get the associated token account for the user's wallet
  const stakerTokenAccount = await getAssociatedTokenAddress(
    AIR_TOKEN_MINT,
    wallet.publicKey
  );
  
  // Create transaction
  const tx = await (program as any).methods
    .claimRewards()
    .accounts({
      pool: poolAddress,
      stakeAccount,
      staker: wallet.publicKey,
      tokenVault,
      stakerTokenAccount,
      systemProgram: web3.SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();
  
  // Sign and send transaction
  if (wallet.sendTransaction) {
    return await wallet.sendTransaction(tx);
  }
  
  // Fallback to sign + send manually
  const signedTx = await wallet.signTransaction(tx);
  const serializedTx = signedTx.serialize();
  const signature = await connection.sendRawTransaction(serializedTx);
  return signature;
}

// Get stake account information
export async function getStakeInfo(connection: Connection, walletAddress: PublicKey) {
  try {
    const dummyWallet: ReadOnlyWallet = {
      publicKey: walletAddress,
      signTransaction: async (tx: Transaction) => tx,
      signAllTransactions: async (txs: Transaction[]) => txs,
    };
    
    const program = getYieldProgram(connection, dummyWallet);
    const stakeAccount = await findStakeAccount(walletAddress);
    const stakeInfo = await (program as any).account.stakeAccount.fetchNullable(stakeAccount);
    
    return stakeInfo;
  } catch (error) {
    console.error("Error fetching stake info:", error);
    return null;
  }
}

// Get pool information
export async function getPoolInfo(connection: Connection) {
  try {
    // Using a dummy wallet just for reading
    const dummyWallet: ReadOnlyWallet = {
      publicKey: new PublicKey("11111111111111111111111111111111"),
      signTransaction: async (tx: Transaction) => tx,
      signAllTransactions: async (txs: Transaction[]) => txs,
    };
    
    const program = getYieldProgram(connection, dummyWallet);
    const poolAddress = await findPoolAddress();
    const poolInfo = await (program as any).account.pool.fetchNullable(poolAddress);
    
    return poolInfo;
  } catch (error) {
    console.error("Error fetching pool info:", error);
    return null;
  }
}

// Calculate estimated rewards
export function calculateEstimatedRewards(
  stakeAmount: number,
  apyPercent: number,
  daysStaked: number
) {
  // Convert APY to daily rate
  const dailyRate = apyPercent / 365;
  
  // Calculate rewards
  const estimatedRewards = stakeAmount * (dailyRate / 100) * daysStaked;
  
  return estimatedRewards;
}

// Format date to display unlock date
export function formatUnlockDate(startTimestamp: number, lockPeriodSeconds: number) {
  const unlockDate = new Date((startTimestamp + lockPeriodSeconds) * 1000);
  return unlockDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Create a React hook to get user's staking info
export function useStakingInfo(connection: Connection) {
  const { publicKey, connected } = useWallet();
  const [loading, setLoading] = useState(true);
  const [stakingInfo, setStakingInfo] = useState<StakeAccount | null>(null);
  const [poolInfo, setPoolInfo] = useState<Pool | null>(null);
  
  useEffect(() => {
    async function fetchStakingInfo() {
      if (!connected || !publicKey) {
        setStakingInfo(null);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      try {
        const [userStakeInfo, poolData] = await Promise.all([
          getStakeInfo(connection, publicKey),
          getPoolInfo(connection)
        ]);
        
        setStakingInfo(userStakeInfo as StakeAccount);
        setPoolInfo(poolData as Pool);
      } catch (error) {
        console.error("Error fetching staking info:", error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchStakingInfo();
  }, [connection, publicKey, connected]);
  
  return { loading, stakingInfo, poolInfo };
} 