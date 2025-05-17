// @ts-nocheck

import { useCallback, useState } from 'react';
import { useAnchorProgram } from './useAnchorProgram';
import { BN } from '@project-serum/anchor';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { Address } from '@solana/kit';
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { getPositionAddress } from '@orca-so/whirlpools-client';
import {
  elizaConfig,
  poolState,
  rewardTokenMint,
} from '@/constants/constants';
import { getPositionVaultPDA } from '@/services/getPositionVault';
import { toast } from 'sonner';

interface StakeResult {
  signature: string;
  stakeEntryAddress: PublicKey;
  stakedAmount: BN;
}

export const useStake = () => {
  const { program, provider } = useAnchorProgram();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stake = useCallback(async (
    positionMintAddress: PublicKey,
    whirlpoolAddress: PublicKey,
    stakeDurationSeconds: number
  ): Promise<StakeResult | null> => {
    if (!program || !provider || !(provider as any).wallet?.publicKey) {
      setError('Wallet not connected');
      toast.error('Wallet not connected');
      return null;
    }
    if (!positionMintAddress || !whirlpoolAddress) {
      setError('Position Mint and Whirlpool Address are required.');
      toast.error('Position Mint and Whirlpool Address are required.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = (provider as any).wallet.publicKey;

      const userRewardTokenAccount = getAssociatedTokenAddressSync(
        rewardTokenMint,
        user,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      let rewardAtaTransaction: Transaction | undefined;
      try {
        await getAccount((provider as any).connection, userRewardTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
      } catch {
        console.log(`Reward ATA not found for ${rewardTokenMint.toBase58()}, creating it.`);
        rewardAtaTransaction = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            user, userRewardTokenAccount, user, rewardTokenMint, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      const [userStakeEntryPDA] = PublicKey.findProgramAddressSync(
        [user.toBuffer(), poolState.toBuffer(), Buffer.from('stake_entry')],
        program.programId
      );

      const [poolAuthorityPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault_authority')],
        program.programId
      );
      
      const positionVaultPDA = getPositionVaultPDA(positionMintAddress, userStakeEntryPDA, program.programId)[0];

      const userPositionTokenAccount = getAssociatedTokenAddressSync(
        positionMintAddress,
        user,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      
      const positionAccountForStakeInstruction = positionMintAddress;

      const transaction = new Transaction();
      if (rewardAtaTransaction) {
        transaction.add(rewardAtaTransaction);
      }

      let stakeEntryAccountInfo = null;
      try {
        stakeEntryAccountInfo = await program.account.stakedPosition.fetch(userStakeEntryPDA);
      } catch (e) {
        console.log(`Stake entry ${userStakeEntryPDA.toBase58()} not found, creating init instruction.`);
        const initStakeEntryIx = await program.methods
          .initStakeEntry()
          .accounts({
            elizaConfig,
            user,
            userStakeEntry: userStakeEntryPDA,
            position: positionAccountForStakeInstruction,
            userRewardTokenAccount,
            rewardTokenMint,
            poolState,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        transaction.add(initStakeEntryIx);
      }

      const duration = new BN(stakeDurationSeconds);
      const stakeIx = await program.methods
        .stake(duration)
        .accountsStrict({
          elizaConfig,
          poolState,
          position: positionAccountForStakeInstruction,
          positionMint: positionMintAddress,
          poolAuthority: poolAuthorityPDA,
          positionVault: positionVaultPDA,
          user,
          userPositionTokenAccount,
          userStakeEntry: userStakeEntryPDA,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          whirlpool: whirlpoolAddress,
          systemProgram: SystemProgram.programId,
        })
        .instruction();
      transaction.add(stakeIx);

      const signature = await provider.sendAndConfirm(transaction);
      toast.success(`Successfully staked! Tx: ${signature.substring(0, 8)}...`);
      
      const finalStakeEntryData = await program.account.stakedPosition.fetch(userStakeEntryPDA);

      return {
        signature,
        stakeEntryAddress: userStakeEntryPDA,
        stakedAmount: finalStakeEntryData.liquidity,
      };

    } catch (err: any) {
      console.error('Stake failed:', err);
      setError(err.message || 'An unknown error occurred during staking.');
      toast.error(err.message || 'Stake failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [program, provider]);

  return { stake, isLoading, error };
};
