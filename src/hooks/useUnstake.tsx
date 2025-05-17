import { useCallback, useState } from 'react';
import { useAnchorProgram } from './useAnchorProgram';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
// Restore original import for constants
import {
  elizaConfig,
  poolState,
  rewardTokenMint,
} from '@/constants/constants'; 
import { getPositionVaultPDA } from '@/services/getPositionVault'; // This will still be an issue
import { getRewardTokenVaultPDA } from '@/services/pdaUtils'; // This will still be an issue
// getPositionAddress from orca-so/whirlpools-client might not be needed if positionMint is the key for Eliza
// import { getPositionAddress } from '@orca-so/whirlpools-client'; 
// import { Address } from '@solana/kit';
import { toast } from 'sonner';
import { BN } from '@project-serum/anchor';

// Remove inlined constants
// const ELIZA_PROGRAM_ID_STR = process.env.NEXT_PUBLIC_ELIZA_PROGRAM_ID || '11111111111111111111111111111111';
// const REWARD_TOKEN_MINT_STR = process.env.NEXT_PUBLIC_REWARD_TOKEN_MINT || '11111111111111111111111111111111';
// const POOL_STATE_STR = '11111111111111111111111111111111';
// const elizaConfig = new PublicKey(ELIZA_PROGRAM_ID_STR);
// const rewardTokenMint = new PublicKey(REWARD_TOKEN_MINT_STR);
// const poolState = new PublicKey(POOL_STATE_STR);

interface UnstakeResult {
  signature: string;
  claimedRewards?: typeof BN; // Changed BN to typeof BN as suggested by linter
}

// Removed WhirlpoolType and related logic as it seems out of place for a generic unstake hook
// The specific whirlpool a position belongs to should ideally be known or fetched via the stakeEntry/positionMint

export const useUnstake = () => {
  const { program, provider } = useAnchorProgram();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Removed positionMint and setPositionMint state, 
  // positionMint should be derivable from the stakeEntry or passed if necessary.

  const unstake = useCallback(async (
    userStakeEntryAddress: PublicKey,
    positionMintAddress: PublicKey
  ): Promise<UnstakeResult | null> => {
    if (!program || !provider || !(provider as any).wallet?.publicKey) {
      setError('Wallet not connected');
      toast.error('Wallet not connected');
      return null;
    }
    if (!userStakeEntryAddress || !positionMintAddress) {
      setError('Stake Entry Address and Position Mint Address are required for unstaking.');
      toast.error('Stake Entry Address and Position Mint Address are required.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = (provider as any).wallet.publicKey;

      // 1. Fetch stake entry data to get necessary info (e.g., actual position, original whirlpool if needed)
      // This step is crucial. For now, we assume positionMintAddress passed is correct.
      // const stakeEntryData = await program.account.stakedPosition.fetch(userStakeEntryAddress);
      // const actualPositionMint = stakeEntryData.positionMint; // Or however it's stored
      // const actualWhirlpool = stakeEntryData.whirlpool; // If stored

      // 2. Ensure user has an Associated Token Account for the reward token
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
        console.log(`Reward ATA for ${rewardTokenMint.toBase58()} not found, creating it.`);
        rewardAtaTransaction = new Transaction().add(
          createAssociatedTokenAccountInstruction(
            user, userRewardTokenAccount, user, rewardTokenMint, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }
      
      // 3. Get PDAs and other necessary accounts
      const [poolAuthorityPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault_authority')],
        (program as any).programId
      );

      // The `positionVault` PDA is derived using the position mint and the user's stake entry PDA.
      const positionVaultPDA = getPositionVaultPDA(positionMintAddress, userStakeEntryAddress, (program as any).programId)[0];
      
      // This is the token account for the LP token being unstaked, owned by the user.
      const userPositionTokenAccount = getAssociatedTokenAddressSync(
        positionMintAddress, // This is the mint of the token in the vault
        user,
        false,
        TOKEN_2022_PROGRAM_ID
      );

      // The actual on-chain position account (e.g., Orca position NFT or similar)
      // This needs to be correctly identified. It might be stored in the stakeEntryData or be the positionMintAddress itself.
      // For now, assuming positionMintAddress is used as the 'position' identifier for the program.
      const positionAccountForInstruction = positionMintAddress; 

      // Derive the program's reward token vault PDA once using helper
      const [rewardTokenVaultPDA] = getRewardTokenVaultPDA(poolState, (program as any).programId);

      // 4. Build Transaction
      const transaction = new Transaction();
      if (rewardAtaTransaction) {
        transaction.add(rewardAtaTransaction as any);
      }

      const unstakeIx = await (program as any).methods
        .unstake() // Assuming this also claims rewards
        .accountsStrict({
          elizaConfig,
          poolState,
          position: positionAccountForInstruction, // The actual LP position account
          positionMint: positionMintAddress,    // Mint of the LP token
          poolAuthority: poolAuthorityPDA,
          positionVault: positionVaultPDA,      // PDA vault holding the LP token
          rewardTokenVault: rewardTokenVaultPDA, // Program's reward vault
          user,
          userTokenAccount: userPositionTokenAccount, // User's account for receiving LP token back
          userStakeEntry: userStakeEntryAddress,   // User's stake entry account
          rewardTokenMint,
          userRewardTokenAccount,               // User's account for receiving rewards
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          // whirlpool: whirlpoolAddressForInstruction, // This might be needed if program interacts with whirlpool directly
        })
        .instruction();
      transaction.add(unstakeIx as any);

      const signature = await (provider as any).sendAndConfirm(transaction as any);
      toast.success(`Successfully unstaked! Tx: ${signature.substring(0, 8)}...`);

      // Optionally, fetch claimed rewards if the event or on-chain data provides it.
      // For now, we don't have a direct way to get this from the `unstake` instruction alone
      // without observing account changes or having the program return it.

      return {
        signature,
        // claimedRewards: new BN(0) // Placeholder for now
      };

    } catch (err: any) {
      console.error('Unstake failed:', err);
      setError(err.message || 'An unknown error occurred during unstaking.');
      toast.error(err.message || 'Unstake failed');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [program, provider]);

  return { unstake, isLoading, error };
};