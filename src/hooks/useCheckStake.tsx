import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { useAnchorProgram } from './useAnchorProgram';
import { poolState } from '@/constants/constants';
import { useWallet } from '@solana/wallet-adapter-react';

export const useCheckStake = () => {
  const { program } = useAnchorProgram();
  const { publicKey } = useWallet();
  const [isStaked, setIsStaked] = useState(false);
  const [stakeEntry, setStakeEntry] = useState<PublicKey | null>(null);
  const [stakedPosition, setStakedPosition] = useState<{
    liquidity: bigint;
    rewards: bigint;
    startTime: bigint;
    unlockTime: bigint;
    pubKey: PublicKey;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkStakeStatus = async () => {
      if (!program || !publicKey) {
        setIsStaked(false);
        setStakedPosition(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Calculate the PDA for stake entry
        const [stakeEntryPDA] = PublicKey.findProgramAddressSync(
          [publicKey.toBuffer(), poolState.toBuffer(), Buffer.from('stake_entry')],
          program.programId
        );
        
        setStakeEntry(stakeEntryPDA);

        // Try to fetch the stake entry
        try {
          const stakeEntryAccount = await program.account.stakedPosition.fetch(stakeEntryPDA);
          if (stakeEntryAccount) {
            // Ensure rewards is always a valid bigint (use 0 if it's undefined or null)
            const rewards = stakeEntryAccount.rewards !== undefined && stakeEntryAccount.rewards !== null 
              ? stakeEntryAccount.rewards 
              : BigInt(0);
            
            setIsStaked(true);
            setStakedPosition({
              liquidity: stakeEntryAccount.liquidity || BigInt(0),
              rewards: rewards,
              startTime: stakeEntryAccount.startTime || BigInt(0),
              unlockTime: stakeEntryAccount.unlockTime || BigInt(0),
              pubKey: stakeEntryPDA
            });
            
            console.log('Staked position data:', {
              liquidity: stakeEntryAccount.liquidity?.toString(),
              rewards: rewards?.toString(),
              startTime: stakeEntryAccount.startTime?.toString(),
              unlockTime: stakeEntryAccount.unlockTime?.toString()
            });
          }
        } catch (err) {
          // Entry doesn't exist or some other error
          console.error('Error fetching stake entry:', err);
          setIsStaked(false);
          setStakedPosition(null);
        }
      } catch (err) {
        console.error('Error checking stake status:', err);
        setError('Failed to check stake status');
      } finally {
        setIsLoading(false);
      }
    };

    checkStakeStatus();
  }, [program, publicKey]);

  // Calculate time remaining until unlock
  const getTimeRemaining = () => {
    if (!stakedPosition) return null;
    
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const unlockTime = Number(stakedPosition.unlockTime); // Convert bigint to number
    
    if (currentTime >= unlockTime) {
      return { canUnstake: true, remaining: 0 };
    }
    
    const remaining = unlockTime - currentTime;
    return { 
      canUnstake: false, 
      remaining,
      formattedRemaining: formatTimeRemaining(remaining)
    };
  };

  // Format time remaining into a human-readable string
  const formatTimeRemaining = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0) result += `${minutes}m`;
    
    return result.trim();
  };

  return { 
    isStaked, 
    stakeEntry, 
    stakedPosition, 
    isLoading, 
    error,
    getTimeRemaining
  };
}; 