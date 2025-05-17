import { useCallback, useState } from 'react';
import { useAnchorProgram } from './useAnchorProgram';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import { toast } from 'sonner';
import { elizaConfig, poolState, rewardTokenMint } from '@/constants/constants';
import { getRewardTokenVaultPDA } from '@/services/pdaUtils';

interface HarvestResult {
  signature: string;
  harvestedAmount?: bigint; // Placeholder, adjust if program returns exact amount.
}

export const useHarvest = () => {
  const { program, provider } = useAnchorProgram();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Harvest rewards from an existing stake entry.
   * @param userStakeEntryAddress The PDA of user's stake entry.
   */
  const harvest = useCallback(async (
    userStakeEntryAddress: PublicKey
  ): Promise<HarvestResult | null> => {
    if (!program || !provider || !(provider as any).wallet?.publicKey) {
      setError('Wallet not connected');
      toast.error('Wallet not connected');
      return null;
    }

    if (!userStakeEntryAddress) {
      setError('Stake entry address required');
      toast.error('Stake entry address required');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = (provider as any).wallet.publicKey;

      // Ensure user has ATA for reward token
      const userRewardTokenAccount = getAssociatedTokenAddressSync(
        rewardTokenMint,
        user,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      let ataIx: Transaction | undefined;
      try {
        await getAccount((provider as any).connection, userRewardTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
      } catch {
        ataIx = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            user,
            userRewardTokenAccount,
            user,
            rewardTokenMint,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      // Program reward vault PDA
      const [rewardTokenVault] = getRewardTokenVaultPDA(poolState, (program as any).programId);

      const tx = new Transaction();
      if (ataIx) tx.add(ataIx);

      const harvestIx = await (program as any).methods
        .harvest()
        .accountsStrict({
          elizaConfig,
          poolState,
          user,
          rewardTokenMint,
          rewardTokenVault,
          userRewardTokenAccount,
          userStakeEntry: userStakeEntryAddress,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .instruction();

      tx.add(harvestIx);

      const signature = await (provider as any).sendAndConfirm(tx);

      toast.success(`Harvested rewards! Tx: ${signature.substring(0, 8)}...`);

      return {
        signature,
      };
    } catch (err: any) {
      console.error('Harvest failed:', err);
      setError(err.message ?? 'Harvest failed');
      toast.error(err.message ?? 'Harvest failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [program, provider]);

  return { harvest, isLoading, error };
}; 