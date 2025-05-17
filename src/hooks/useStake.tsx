import { useAnchorProgram } from './useAnchorProgram';
import { BN } from '@project-serum/anchor';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { Address } from '@solana/kit'
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token';
import { getPositionAddress } from '@orca-so/whirlpools-client';
import {
  elizaConfig,
  poolState,
  rewardTokenMint,
  whirlpoolAddress,
} from '@/constants/constants';
import { getPositionVaultPDA } from '@/services/getPositionVault';
import { useState } from 'react';

export const useStake = () => {
  const { program, provider } = useAnchorProgram();
  const [positionMint, setPositionMint] = useState('');

  const stake = async (stakingTime: string, setStakeEntryAccount: (stakeEntryAccount: { liquidity: bigint, pubKey: PublicKey }) => void) => {
    if (!program || !provider || !(provider as any).wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    const user = (provider as any).wallet.publicKey;
    const positionMintPK = new PublicKey(positionMint);

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


    try {
      await getAccount((provider as any).connection, userRewardTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
      console.log('ATA already exists.');
    } catch {
      console.log(`Not found → create it`);
      // Not found → create it
      const ataIx = createAssociatedTokenAccountInstruction(
        user,
        userRewardTokenAccount,
        user,
        rewardTokenMint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      await (provider as any).sendAndConfirm(new Transaction().add(ataIx));
      console.log('Created ATA:', userRewardTokenAccount.toBase58());
    }

    const positionId = (await getPositionAddress(positionMintPK.toString() as Address))[0];
    console.log("positionId", positionId);

    const [stakeEntry] = PublicKey.findProgramAddressSync(
      [user.toBuffer(), poolState.toBuffer(), Buffer.from('stake_entry')],
      (program as any).programId
    );

    const [poolAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault_authority')],
      (program as any).programId
    );

    const duration = new BN(stakingTime);

    const transaction = new Transaction();

    const positionVault = getPositionVaultPDA(positionMintPK, stakeEntry, (program as any).programId)[0];


    const initStakeEntryIx = await (program as any).methods
      .initStakeEntry()
      .accounts({
        elizaConfig,
        user,
        userStakeEntry: stakeEntry,
        userRewardTokenAccount,
        rewardTokenMint,
        poolState,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const stakeIx = await (program as any).methods
      .stake(duration)
      .accountsStrict({
        elizaConfig,
        poolState,
        position: positionId,
        positionMint: positionMintPK,
        poolAuthority,
        positionVault,
        user,
        userPositionTokenAccount,
        userStakeEntry: stakeEntry,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        whirlpool: whirlpoolAddress,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    transaction.add(stakeIx);

    const txSig = await (provider as any).sendAndConfirm(transaction);

    console.log('Stake transaction:', txSig);

    const stakeEntryAccount = await (program as any).account.stakedPosition.fetch(stakeEntry);
    stakeEntryAccount.pubKey = stakeEntry;
    setStakeEntryAccount(stakeEntryAccount as { liquidity: bigint; pubKey: PublicKey });
    return txSig;
  };

  return { stake, positionMint, setPositionMint };
};
