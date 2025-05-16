import { useState, useCallback } from 'react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { useAnchorProgram } from './useAnchorProgram';
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { elizaConfig, rewardTokenMint } from '@/constants/constants';
import { BN } from '@project-serum/anchor';
import { getPositionAddress } from '@orca-so/whirlpools-client';
import { Address } from '@solana/kit';
import { getPositionVaultPDA } from '@/services/getPositionVault';

export const useHarvest = () => {
  const { program, provider } = useAnchorProgram();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculatedRewards, setCalculatedRewards] = useState<string | null>(null);

  const getEarnedRewards = useCallback(async (stakeEntry: PublicKey) => {
    if (!program || !provider) {
      return '0';
    }

    try {
      // Fetch the stake entry data
      const stakeEntryData = await (program as any).account.stakedPosition.fetch(stakeEntry);
      
      // Get the rewards value
      const rewards = stakeEntryData.rewards.toString();
      setCalculatedRewards(rewards);
      
      return rewards;
    } catch (err) {
      console.error('Error calculating rewards:', err);
      return '0';
    }
  }, [program, provider]);

  const harvest = useCallback(async (
    poolState: PublicKey,
    positionMint: PublicKey,
    stakeEntry: PublicKey
  ) => {
    if (!program || !provider || !(provider as any).wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const user = (provider as any).wallet.publicKey;
      
      console.log('Executing claim rewards with parameters:');
      console.log('- Pool State:', poolState.toBase58());
      console.log('- Position Mint:', positionMint.toBase58());
      console.log('- Stake Entry:', stakeEntry.toBase58());
      
      // Get pool authority
      const [poolAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault_authority')],
        (program as any).programId
      );
      console.log('- Pool Authority:', poolAuthority.toBase58());

      // Get reward token vault
      const [rewardTokenVault] = PublicKey.findProgramAddressSync(
        [Buffer.from('reward_vault'), poolState.toBuffer()],
        (program as any).programId
      );
      console.log('- Reward Token Vault:', rewardTokenVault.toBase58());

      // Get user reward token account
      const userRewardTokenAccount = getAssociatedTokenAddressSync(
        rewardTokenMint,
        user,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      console.log('- User Reward Token Account:', userRewardTokenAccount.toBase58());

      // Get stake entry data for logging purposes
      let stakeEntryData;
      try {
        stakeEntryData = await (program as any).account.stakedPosition.fetch(stakeEntry);
        if (stakeEntryData) {
          const onChainRewards = stakeEntryData.rewards;
          console.log('- On-chain rewards value:', onChainRewards ? onChainRewards.toString() : '0');
          
          // Log stake entry info for debugging
          console.log('Stake entry data:', {
            user: stakeEntryData.user ? stakeEntryData.user.toBase58() : 'unknown',
            liquidity: stakeEntryData.liquidity ? stakeEntryData.liquidity.toString() : '0',
            startTime: stakeEntryData.startTime ? stakeEntryData.startTime.toString() : '0',
            unlockTime: stakeEntryData.unlockTime ? stakeEntryData.unlockTime.toString() : '0',
          });
        }
      } catch (err) {
        console.warn('Could not fetch stake entry data:', err);
        // Continue with claim - don't return/exit here
      }

      // Build transaction
      const transaction = new Transaction();
      
      // Check if user reward token account exists
      try {
        await getAccount((provider as any).connection, userRewardTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
        console.log('Reward token account exists.');
      } catch {
        console.log(`Reward token account not found → creating it`);
        const ataIx = createAssociatedTokenAccountInstruction(
          user,
          userRewardTokenAccount,
          user,
          rewardTokenMint,
          TOKEN_2022_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        );
        transaction.add(ataIx);
      }

      // Create claim rewards instruction - FIXED: Using the correct method name that exists in the program
      try {
        // Get the position based on the positionMint using Orca whirlpool client
        let positionId;
        
        // Try two approaches to get position ID
        // 1. First try to get it from stake entry data if available
        if (stakeEntryData && stakeEntryData.position) {
          positionId = stakeEntryData.position;
          console.log("Using position from stake entry:", positionId.toBase58());
        } 
        // 2. If not available in stake entry, derive it from position mint
        else {
          try {
            console.log("Deriving position from position mint:", positionMint.toBase58());
            const positionAddressResult = await getPositionAddress(positionMint.toString() as Address);
            positionId = new PublicKey(positionAddressResult[0].toString());
            console.log("Derived position ID:", positionId.toBase58());
          } catch (err) {
            console.error("Error deriving position address:", err);
            return {
              success: false,
              message: "Failed to derive position address from mint"
            };
          }
        }

        if (!positionId) {
          return {
            success: false, 
            message: "Could not determine position ID"
          };
        }
        
        // Get the position vault using the correct seed derivation
        const [positionVault, /* positionVaultBump */] = getPositionVaultPDA(positionMint, stakeEntry, (program as any).programId);
        console.log("Position vault:", positionVault.toBase58());
        
        // Check if the reward token vault exists
        try {
          // Check if reward token vault exists
          const rewardVaultInfo = await (provider as any).connection.getAccountInfo(rewardTokenVault);
          if (!rewardVaultInfo) {
            console.log("Reward token vault doesn't exist. It needs to be initialized.");
            
            return {
              success: false,
              message: `The reward token vault is not initialized for this pool. Before you can claim rewards, an admin needs to:
              1. Initialize the pool using initPool() if not already done
              2. Add rewards to the pool using increasePoolRewards()
              Please contact the pool administrator to add rewards to the pool.`
            };
          } else {
            console.log("Reward token vault exists:", rewardTokenVault.toBase58());
          }
        } catch (err) {
          console.error("Error checking reward token vault:", err);
          return {
            success: false,
            message: "Failed to check reward token vault status"
          };
        }
        
        // Get user position token account
        const userPositionTokenAccount = getAssociatedTokenAddressSync(
          positionMint,
          user,
          false,
          TOKEN_2022_PROGRAM_ID
        );
        console.log("User position token account:", userPositionTokenAccount.toBase58());
        
        console.log("Preparing unstake instruction with accounts:", {
          elizaConfig: elizaConfig.toBase58(),
          poolState: poolState.toBase58(),
          position: positionId ? `PK_INSTANCE` : "NOT_PK_INSTANCE",
          positionMint: positionMint.toBase58(),
          poolAuthority: poolAuthority.toBase58(),
          positionVault: positionVault.toBase58(),
          rewardTokenVault: rewardTokenVault.toBase58(),
          user: user.toBase58(),
          userTokenAccount: userPositionTokenAccount.toBase58(),
          userStakeEntry: stakeEntry.toBase58(),
          rewardTokenMint: rewardTokenMint.toBase58(),
          userRewardTokenAccount: userRewardTokenAccount.toBase58()
        });

        const claimRewardsIx = await (program as any).methods
          .unstake()
          .accountsStrict({
            elizaConfig,
            poolState,
            position: positionId,
            positionMint: positionMint,
            poolAuthority,
            positionVault,
            rewardTokenVault,
            user,
            userTokenAccount: userPositionTokenAccount,
            userStakeEntry: stakeEntry,
            rewardTokenMint,
            userRewardTokenAccount,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        
        transaction.add(claimRewardsIx);
      } catch (err) {
        console.error('Error creating claim rewards instruction:', err);
        return {
          success: false,
          message: `Failed to create claim rewards instruction: ${err instanceof Error ? err.message : 'Unknown error'}`
        };
      }
      
      // Send transaction
      try {
        console.log('Sending real claim rewards transaction...');
        
        // Get recentBlockhash to ensure the transaction is fresh
        const { blockhash } = await (provider as any).connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = user;
        
        // Sign and send transaction
        const signature = await (provider as any).sendAndConfirm(transaction, [], {
          skipPreflight: false,
          preflightCommitment: 'confirmed',
          maxRetries: 3
        });
        
        console.log('Claim rewards transaction confirmed! Signature:', signature);
        
        // Update calculated rewards
        setCalculatedRewards('0');
        
        return {
          success: true,
          signature,
          message: 'Successfully claimed rewards',
          tx: signature
        };
      } catch (err) {
        console.error('Error sending transaction:', err);
        if ((err as any).logs) {
          console.error('Transaction logs:', (err as any).logs);
          
          // Check for specific error related to reward_token_vault not initialized
          const logs = (err as any).logs;
          if (logs.some((log: string) => 
              log.includes('AnchorError') && 
              log.includes('reward_token_vault') && 
              log.includes('AccountNotInitialized'))) {
            return {
              success: false,
              message: `The reward token vault is not initialized for this pool. Before you can claim rewards, an admin needs to:
              1. Initialize the pool using initPool() if not already done
              2. Add rewards to the pool using increasePoolRewards()
              Please contact the pool administrator to add rewards to the pool.`
            };
          }
        }
        
        return {
          success: false,
          message: `Transaction failed: ${err instanceof Error ? err.message : 'Unknown error'}`
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to claim rewards';
      console.error('Claim rewards error:', err);
      
      // Add more detailed error message if logs are available
      if ((err as any).logs) {
        console.error('Error logs:', (err as any).logs);
      }
      
      setError(errorMsg);
      return {
        success: false,
        message: errorMsg
      };
    } finally {
      setIsLoading(false);
    }
  }, [program, provider]);

  return {
    harvest,
    getEarnedRewards,
    calculatedRewards,
    isLoading,
    error
  };
}; 