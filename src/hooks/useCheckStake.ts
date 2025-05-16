import { useEffect, useState, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useAnchorProgram } from './useAnchorProgram';
import { poolState } from '@/constants/constants';
import { getUserStakeEntryPDA } from '@/services/pdaUtils';

interface StakedPositionData {
  user: PublicKey;
  pool: PublicKey;
  position: PublicKey;
  userRewardTokenAccount: PublicKey;
  liquidity: bigint;
  rewardPerTokenPaid: bigint;
  rewards: bigint;
  startTime: bigint;
  unlockTime: bigint;
  rewardMultiplier: bigint;
  pubKey?: PublicKey;
}

export const useCheckStake = () => {
  const { program, provider } = useAnchorProgram();
  const [isStaked, setIsStaked] = useState(false);
  const [stakedPosition, setStakedPosition] = useState<StakedPositionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkStakingStatus = useCallback(async () => {
    if (!program || !provider || !(provider as any).wallet || !(provider as any).wallet.publicKey) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = (provider as any).wallet.publicKey;
      
      // Get stake entry PDA
      const [stakeEntry] = getUserStakeEntryPDA(user, poolState, (program as any).programId);
      
      // Try to fetch stake entry data
      try {
        const stakeEntryData = await (program as any).account.stakedPosition.fetch(stakeEntry);
        
        // Ensure the data is valid and belongs to this user
        if (stakeEntryData && stakeEntryData.user.equals(user)) {
          setIsStaked(true);
          
          // Create a complete StakedPositionData object with the pubKey added
          const stakedPositionWithPubKey: StakedPositionData = {
            ...stakeEntryData as any, // Cast to any first to avoid TypeScript errors
            pubKey: stakeEntry
          };
          
          setStakedPosition(stakedPositionWithPubKey);
        } else {
          setIsStaked(false);
          setStakedPosition(null);
        }
      } catch (e) {
        // If account not found or error, the user is not staked
        setIsStaked(false);
        setStakedPosition(null);
      }
    } catch (err) {
      setError('Failed to check staking status');
      console.error('Error checking stake status:', err);
    } finally {
      setIsLoading(false);
    }
  }, [program, provider]);

  // Check if stake is still locked
  const isLocked = useCallback(() => {
    if (!stakedPosition) return false;
    
    const now = new Date().getTime() / 1000;
    return Number(stakedPosition.unlockTime) > now;
  }, [stakedPosition]);

  // Calculate time remaining until unlock
  const getTimeRemaining = useCallback(() => {
    if (!stakedPosition) return null;
    
    const now = new Date().getTime() / 1000;
    const unlockTime = Number(stakedPosition.unlockTime);
    
    if (unlockTime <= now) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isLocked: false
      };
    }
    
    const remainingSeconds = unlockTime - now;
    const days = Math.floor(remainingSeconds / 86400);
    const hours = Math.floor((remainingSeconds % 86400) / 3600);
    const minutes = Math.floor((remainingSeconds % 3600) / 60);
    const seconds = Math.floor(remainingSeconds % 60);
    
    return {
      days,
      hours,
      minutes,
      seconds,
      isLocked: true
    };
  }, [stakedPosition]);

  // Check status when connected wallet changes
  const walletPublicKeyForEffect = (provider as any)?.wallet?.publicKey;
  useEffect(() => {
    checkStakingStatus();
  }, [checkStakingStatus, walletPublicKeyForEffect]);

  return {
    isStaked,
    stakedPosition,
    isLoading,
    error,
    checkStakingStatus,
    isLocked,
    getTimeRemaining
  };
}; 