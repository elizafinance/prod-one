import { useAnchorProgram } from './useAnchorProgram';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { elizaConfig, poolState, rewardTokenMint, rewardTokenVault } from '../constants/constants';
import { getPositionVaultPDA } from '../services/getPositionVault';
import { getPositionAddress } from '@orca-so/whirlpools-client';
import { Address } from '@solana/kit';
import { useState } from 'react';

export const useUnstake = () => {
  const { program, provider } = useAnchorProgram();
  const [positionMint, setPositionMint] = useState('');

  const unstake = async (userStakeEntryAddress: PublicKey) => {
    if (!program || !provider || !(provider as any).wallet?.publicKey) {
      throw new Error('Wallet not connected');
    }

    const user = (provider as any).wallet.publicKey;
    const positionMintPK = new PublicKey("HRYDPPBeg8QW322vE8JS4C2cDRUHEYHznYWG4ttsahcc");

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
      (program as any).programId
    );

    const [stakeEntry] = PublicKey.findProgramAddressSync(
      [user.toBuffer(), poolState.toBuffer(), Buffer.from('stake_entry')],
      (program as any).programId
    );

    const positionId = (await getPositionAddress(positionMintPK.toString() as Address))[0];
    console.log("positionId", positionId);

    const positionVault = getPositionVaultPDA(positionMintPK, stakeEntry, (program as any).programId)[0];

    const transaction = new Transaction();

    const unstakeIx = await (program as any).methods
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

    const txSig = await (provider as any).sendAndConfirm(transaction);

    console.log('Unstake transaction:', txSig);
    return txSig;
  };

  return { unstake, positionMint, setPositionMint };
};