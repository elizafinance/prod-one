// @ts-nocheck
import { useState, useCallback } from 'react';
import { SystemProgram, Transaction } from '@solana/web3.js';
import { useAnchorProgram } from './useAnchorProgram';
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { getPositionVaultPDA } from '@/services/getPositionVault';
export const useInitPositionVault = () => {
    const { program, provider } = useAnchorProgram();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const initPositionVault = useCallback(async (positionMint, stakeEntry) => {
        var _a;
        if (!program || !provider || !((_a = provider.wallet) === null || _a === void 0 ? void 0 : _a.publicKey)) {
            throw new Error('Wallet not connected');
        }
        setIsLoading(true);
        setError(null);
        try {
            const user = provider.wallet.publicKey;
            // Get position vault PDA with correct seed order
            const [positionVault, positionVaultBump] = getPositionVaultPDA(positionMint, stakeEntry, program.programId);
            console.log('Position Vault PDA:', positionVault.toBase58());
            console.log('Stake Entry:', stakeEntry.toBase58());
            console.log('Position Mint:', positionMint.toBase58());
            // Create instruction for initializing position vault
            const initPositionVaultIx = await program.methods
                .initPositionVault()
                .accounts({
                positionMint,
                positionVault,
                userStakeEntry: stakeEntry,
                user,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
                .instruction();
            // Send transaction
            const tx = new Transaction().add(initPositionVaultIx);
            const signature = await provider.sendAndConfirm(tx);
            console.log('Position vault initialized, signature:', signature);
            return {
                success: true,
                signature,
                positionVault
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to initialize position vault';
            console.error('Init position vault error:', err);
            setError(errorMsg);
            return {
                success: false,
                message: errorMsg
            };
        }
        finally {
            setIsLoading(false);
        }
    }, [program, provider]);
    return {
        initPositionVault,
        isLoading,
        error
    };
};
