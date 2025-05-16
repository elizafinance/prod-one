import { useAnchorProgram } from './useAnchorProgram';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { elizaConfig, poolState, rewardTokenMint, rewardTokenVault } from '@/constants/constants';
import { getPositionVaultPDA } from '@/services/getPositionVault';
import { getPositionAddress } from '@orca-so/whirlpools-client';
import { Address } from '@solana/kit';
import { useState } from 'react';
import { WhirlpoolType } from './useStake';
import { usdtTrxWhirlpool, usdtBtcWhirlpool, trxBtcWhirlpool } from '@/constants/constants';

// Define a clear return type for unstake
interface UnstakeResult {
  success: boolean;
  signature?: string;
  message: string;
}

export const useUnstake = () => {
  const { program, provider } = useAnchorProgram();
  const [selectedWhirlpool, setSelectedWhirlpool] = useState<WhirlpoolType>('USDT_TRX');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getWhirlpoolConfig = (type: WhirlpoolType) => {
    switch (type) {
      case 'USDT_TRX':
        return usdtTrxWhirlpool;
      case 'USDT_BTC':
        return usdtBtcWhirlpool;
      case 'TRX_BTC':
        return trxBtcWhirlpool;
      default:
        throw new Error('Invalid whirlpool type');
    }
  };

  /**
   * Helper function to safely log objects that might have BN or PublicKey fields
   */
  const safeLogObject = (label: string, obj: any) => {
    if (!obj) {
      console.log(`${label}: null or undefined`);
      return;
    }
    
    try {
      // Create a safe copy with toString called on BigNumbers and PublicKeys
      const safeCopy: Record<string, any> = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value === null || value === undefined) {
          safeCopy[key] = 'null';
        } else if (typeof value === 'object' && 'toString' in value) {
          safeCopy[key] = value.toString();
        } else {
          safeCopy[key] = value;
        }
      });
      console.log(`${label}:`, safeCopy);
    } catch (err) {
      console.log(`Error logging ${label}:`, err);
      console.log(`${label} (fallback):`, obj);
    }
  };

  /**
   * Unstake a staked position
   * @param userStakeEntryAddress The PublicKey of the staked position
   * @returns Promise resolving to an UnstakeResult object
   */
  const unstake = async (userStakeEntryAddress: PublicKey): Promise<UnstakeResult> => {
    if (!program || !provider || !provider.wallet.publicKey) {
      const errorMsg = 'Wallet not connected';
      setError(errorMsg);
      return { success: false, message: errorMsg };
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log("Starting unstake process for position:", userStakeEntryAddress.toString());
      
      // Fetch stake entry data
      let stakeEntry;
      try {
        stakeEntry = await program.account.stakedPosition.fetch(userStakeEntryAddress);
        safeLogObject("Full stake entry data", stakeEntry);
        
        console.log("Stake entry data:", {
          startTime: stakeEntry?.startTime ? stakeEntry.startTime.toString() : 'undefined',
          unlockTime: stakeEntry?.unlockTime ? stakeEntry.unlockTime.toString() : 'undefined',
          liquidity: stakeEntry?.liquidity ? stakeEntry.liquidity.toString() : 'undefined',
          rewards: stakeEntry?.rewards ? stakeEntry.rewards.toString() : 'undefined',
          position: stakeEntry?.position ? stakeEntry.position.toString() : 'undefined'
        });
      } catch (err) {
        console.error("Error fetching stake entry:", err);
        return { success: false, message: "Failed to fetch stake entry data. The position may not exist." };
      }
      
      // Verify we got valid data back
      if (!stakeEntry) {
        return { success: false, message: "No staked position found" };
      }
      
      // Check if lock period has ended
      const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
      const startTime = stakeEntry.startTime.toNumber();
      const unlockTime = stakeEntry.unlockTime.toNumber();
      
      // If unlock time is suspiciously close to start time (less than 5 minutes), skip the check
      const isValidUnlockTime = unlockTime - startTime > 300;
      
      if (isValidUnlockTime && currentTime < unlockTime) {
        const remainingTime = unlockTime - currentTime;
        const remainingDays = Math.floor(remainingTime / (24 * 60 * 60));
        const remainingHours = Math.floor((remainingTime % (24 * 60 * 60)) / 3600);
        const remainingMinutes = Math.floor((remainingTime % 3600) / 60);
        
        let timeDisplay = '';
        if (remainingDays > 0) timeDisplay += `${remainingDays}d `;
        if (remainingHours > 0) timeDisplay += `${remainingHours}h `;
        timeDisplay += `${remainingMinutes}m`;
        
        const errorMsg = `Cannot unstake yet. Lock period ends in ${timeDisplay}.`;
        setError(errorMsg);
        setIsLoading(false);
        return { success: false, message: errorMsg };
      }

      // Determine which whirlpool to use based on the position in the stake entry
      // For now, we'll use the default selected whirlpool
      const whirlpoolConfig = getWhirlpoolConfig(selectedWhirlpool);
      if (!whirlpoolConfig || !whirlpoolConfig.positionMint) {
        const errorMsg = 'Invalid whirlpool configuration';
        setError(errorMsg);
        return { success: false, message: errorMsg };
      }
      
      const user = provider.wallet.publicKey;
      const positionMintPK = whirlpoolConfig.positionMint;

      console.log("Whirlpool:", selectedWhirlpool);
      console.log("Position mint:", positionMintPK ? positionMintPK.toString() : 'undefined');

      // Check the position mint is valid
      if (!positionMintPK) {
        return { success: false, message: "Invalid position mint" };
      }

      // Get token accounts
      const userRewardTokenAccount = getAssociatedTokenAddressSync(
        rewardTokenMint,
        user,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const userPositionTokenAccount = getAssociatedTokenAddressSync(
        positionMintPK,
        user,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault_authority')],
        program.programId
      );

      // Use the position from stake entry if available, otherwise derive it from position mint
      let positionId;
      try {
        // Check if stake entry has a position field and use it if available
        if (stakeEntry.position && typeof stakeEntry.position.toString === 'function') {
          positionId = stakeEntry.position;
          console.log("Using position from stake entry:", positionId.toString());
        } 
        // If no position in stake entry, try to derive it from the position mint
        else {
          console.log("No position in stake entry, deriving from position mint");
          try {
            const positionAddressResult = await getPositionAddress(positionMintPK.toString() as Address);
            positionId = new PublicKey(positionAddressResult[0]);
            console.log("Derived position ID:", positionId.toString());
          } catch (err) {
            console.error("Error deriving position address:", err);
            return { success: false, message: "Failed to derive position address from mint" };
          }
        }
      } catch (err) {
        console.error("Error getting position:", err);
        return { success: false, message: "Failed to determine position address" };
      }

      // Validate positionId
      if (!positionId) {
        return { success: false, message: "Failed to determine position address" };
      }

      // Get the position vault
      let positionVault;
      try {
        positionVault = getPositionVaultPDA(positionMintPK, userStakeEntryAddress, program.programId)[0];
        console.log("Position vault:", positionVault.toString());
      } catch (err) {
        console.error("Error getting position vault:", err);
        return { success: false, message: "Failed to get position vault" };
      }

      const transaction = new Transaction();

      try {
        console.log("Preparing unstake instruction with accounts:", {
          elizaConfig: elizaConfig.toString(),
          poolState: poolState.toString(),
          position: positionId.toString(),
          positionMint: positionMintPK.toString(),
          poolAuthority: poolAuthority.toString(),
          positionVault: positionVault.toString(),
          rewardTokenVault: rewardTokenVault.toString(),
          user: user.toString(),
          userTokenAccount: userPositionTokenAccount.toString(),
          userStakeEntry: userStakeEntryAddress.toString(),
          rewardTokenMint: rewardTokenMint.toString(),
          userRewardTokenAccount: userRewardTokenAccount.toString()
        });

        const unstakeIx = await program.methods
          .unstake()
          .accountsStrict({
            elizaConfig,
            poolState,
            position: positionId,
            positionMint: positionMintPK,
            poolAuthority,
            positionVault,
            rewardTokenVault,
            user,
            userTokenAccount: userPositionTokenAccount,
            userStakeEntry: userStakeEntryAddress,
            rewardTokenMint,
            userRewardTokenAccount,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        transaction.add(unstakeIx);
      } catch (err) {
        console.error("Error creating unstake instruction:", err);
        return { success: false, message: "Failed to create unstake instruction" };
      }

      try {
        console.log("Sending unstake transaction...");
        const txSig = await provider.sendAndConfirm(transaction);
        console.log('Unstake transaction successful:', txSig);
        
        return { 
          success: true, 
          signature: txSig,
          message: 'Successfully unstaked position and claimed rewards'
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to send unstake transaction';
        console.error('Unstake transaction error:', err);
        
        // Add more detailed error message if logs are available
        if ((err as any).logs) {
          console.error('Error logs:', (err as any).logs);
        }
        
        setError(errorMsg);
        return { success: false, message: errorMsg };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to unstake';
      console.error('Unstake error:', err);
      
      // Add more detailed error message if logs are available
      if ((err as any).logs) {
        console.error('Error logs:', (err as any).logs);
      }
      
      setError(errorMsg);
      return { success: false, message: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  return { unstake, selectedWhirlpool, setSelectedWhirlpool, isLoading, error };
};