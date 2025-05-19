// @ts-nocheck
import { useCallback, useState } from 'react';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { useAnchorProgram } from './useAnchorProgram';
import { BN } from '@project-serum/anchor';
import { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import { getPositionAddress } from '@orca-so/whirlpools-client';
import { elizaConfig, rewardTokenMint } from '@/constants/constants';
import { getPositionVaultPDA } from '@/services/getPositionVault';
export const useStaking = () => {
    const { program, provider } = useAnchorProgram();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const initPool = useCallback(async (whirlpool, feeCollector, rewardDuration, isLinear, baseValue, slopeOrExponent, minDepositAmount, maxDepositAmount) => {
        if (!program || !provider || !provider.wallet.publicKey) {
            throw new Error('Wallet not connected');
        }
        setIsLoading(true);
        setError(null);
        try {
            const authority = provider.wallet.publicKey;
            // Derive PDAs
            const [poolState] = PublicKey.findProgramAddressSync([Buffer.from('pool_state'), whirlpool.toBuffer()], program.programId);
            const [poolAuthority] = PublicKey.findProgramAddressSync([Buffer.from('vault_authority')], program.programId);
            const [rewardTokenVault] = PublicKey.findProgramAddressSync([Buffer.from('reward_vault'), poolState.toBuffer()], program.programId);
            const initPoolIx = await program.methods
                .initPool(new BN(rewardDuration), isLinear, new BN(baseValue), new BN(slopeOrExponent), new BN(minDepositAmount), new BN(maxDepositAmount))
                .accounts({
                authority,
                poolAuthority,
                elizaConfig,
                poolState,
                rewardTokenVault,
                rewardTokenMint,
                whirlpool,
                feeCollector,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: PublicKey.default,
            })
                .instruction();
            const tx = new Transaction().add(initPoolIx);
            const signature = await provider.sendAndConfirm(tx);
            return {
                signature,
                poolState,
                rewardTokenVault
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to initialize pool';
            console.error('Init pool error:', err);
            setError(errorMsg);
            throw new Error(errorMsg);
        }
        finally {
            setIsLoading(false);
        }
    }, [program, provider]);
    const initStakeEntry = useCallback(async (poolState, position, positionMint) => {
        if (!program || !provider || !provider.wallet.publicKey) {
            throw new Error('Wallet not connected');
        }
        setIsLoading(true);
        setError(null);
        try {
            const user = provider.wallet.publicKey;
            // Create reward token account if it doesn't exist
            const userRewardTokenAccount = getAssociatedTokenAddressSync(rewardTokenMint, user, false, TOKEN_2022_PROGRAM_ID);
            try {
                await getAccount(provider.connection, userRewardTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
                console.log('Reward token account exists.');
            }
            catch (_a) {
                console.log(`Reward token account not found → creating it`);
                const ataIx = createAssociatedTokenAccountInstruction(user, userRewardTokenAccount, user, rewardTokenMint, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
                await provider.sendAndConfirm(new Transaction().add(ataIx));
                console.log('Created reward token account:', userRewardTokenAccount.toBase58());
            }
            // Calculate stake entry PDA
            const [userStakeEntry] = PublicKey.findProgramAddressSync([user.toBuffer(), poolState.toBuffer(), Buffer.from('stake_entry')], program.programId);
            // Initialize stake entry
            const initStakeEntryIx = await program.methods
                .initStakeEntry()
                .accounts({
                user,
                elizaConfig,
                userStakeEntry,
                position,
                userRewardTokenAccount,
                rewardTokenMint,
                poolState,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
                .instruction();
            // Initialize position vault
            const positionVault = getPositionVaultPDA(positionMint, userStakeEntry, program.programId)[0];
            const tx = new Transaction().add(initStakeEntryIx);
            const signature = await provider.sendAndConfirm(tx);
            return {
                signature,
                userStakeEntry,
                userRewardTokenAccount,
                positionVault
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to initialize stake entry';
            console.error('Init stake entry error:', err);
            setError(errorMsg);
            throw new Error(errorMsg);
        }
        finally {
            setIsLoading(false);
        }
    }, [program, provider]);
    const stake = useCallback(async (poolState, whirlpool, position, positionMint, stakeDuration) => {
        if (!program || !provider || !provider.wallet.publicKey) {
            throw new Error('Wallet not connected');
        }
        setIsLoading(true);
        setError(null);
        try {
            const user = provider.wallet.publicKey;
            // Calculate stake entry PDA
            const [userStakeEntry] = PublicKey.findProgramAddressSync([user.toBuffer(), poolState.toBuffer(), Buffer.from('stake_entry')], program.programId);
            // Get position vault
            const positionVault = getPositionVaultPDA(positionMint, userStakeEntry, program.programId)[0];
            // Get pool authority
            const [poolAuthority] = PublicKey.findProgramAddressSync([Buffer.from('vault_authority')], program.programId);
            // Get user position token account
            const userPositionTokenAccount = getAssociatedTokenAddressSync(positionMint, user, false, TOKEN_2022_PROGRAM_ID);
            // Check if stake entry exists
            let stakeEntryExists = false;
            try {
                await program.account.stakedPosition.fetch(userStakeEntry);
                stakeEntryExists = true;
                console.log('Stake entry already exists');
            }
            catch (error) {
                console.log('Stake entry does not exist, creating new one');
            }
            // Build transaction
            const transaction = new Transaction();
            // Only add initStakeEntryIx if the stake entry doesn't exist
            if (!stakeEntryExists) {
                // Get position account 
                const positionAccount = await getPositionAddress(positionMint.toString());
                const positionId = new PublicKey(positionAccount[0].toString());
                // Create reward token account if it doesn't exist
                const userRewardTokenAccount = getAssociatedTokenAddressSync(rewardTokenMint, user, false, TOKEN_2022_PROGRAM_ID);
                try {
                    await getAccount(provider.connection, userRewardTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
                    console.log('Reward token account exists.');
                }
                catch (_a) {
                    console.log(`Reward token account not found → creating it`);
                    const ataIx = createAssociatedTokenAccountInstruction(user, userRewardTokenAccount, user, rewardTokenMint, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
                    transaction.add(ataIx);
                }
                const initStakeEntryIx = await program.methods
                    .initStakeEntry()
                    .accounts({
                    elizaConfig,
                    user,
                    userStakeEntry,
                    position: positionId,
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
            // Add stake instruction
            const stakeIx = await program.methods
                .stake(new BN(stakeDuration))
                .accounts({
                elizaConfig,
                poolState,
                whirlpool,
                position,
                positionMint,
                poolAuthority,
                positionVault,
                user,
                userPositionTokenAccount,
                userStakeEntry,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
                .instruction();
            transaction.add(stakeIx);
            // Send transaction
            const signature = await provider.sendAndConfirm(transaction);
            // Fetch updated stake entry data
            const stakeEntryData = await program.account.stakedPosition.fetch(userStakeEntry);
            return {
                signature,
                userStakeEntry,
                stakeEntryData
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to stake';
            console.error('Stake error:', err);
            setError(errorMsg);
            throw new Error(errorMsg);
        }
        finally {
            setIsLoading(false);
        }
    }, [program, provider]);
    const unstake = useCallback(async (poolState, position, positionMint, stakeEntry) => {
        if (!program || !provider || !provider.wallet.publicKey) {
            throw new Error('Wallet not connected');
        }
        setIsLoading(true);
        setError(null);
        try {
            const user = provider.wallet.publicKey;
            // Get pool authority
            const [poolAuthority] = PublicKey.findProgramAddressSync([Buffer.from('vault_authority')], program.programId);
            // Get position vault
            const positionVault = getPositionVaultPDA(positionMint, stakeEntry, program.programId)[0];
            // Get reward token vault
            const [rewardTokenVault] = PublicKey.findProgramAddressSync([Buffer.from('reward_vault'), poolState.toBuffer()], program.programId);
            // Get user token accounts
            const userTokenAccount = getAssociatedTokenAddressSync(positionMint, user, false, TOKEN_2022_PROGRAM_ID);
            const userRewardTokenAccount = getAssociatedTokenAddressSync(rewardTokenMint, user, false, TOKEN_2022_PROGRAM_ID);
            // Check if user reward token account exists
            try {
                await getAccount(provider.connection, userRewardTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
                console.log('Reward token account exists.');
            }
            catch (_a) {
                console.log(`Reward token account not found → creating it`);
                const ataIx = createAssociatedTokenAccountInstruction(user, userRewardTokenAccount, user, rewardTokenMint, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
                await provider.sendAndConfirm(new Transaction().add(ataIx));
            }
            // Create unstake instruction
            const unstakeIx = await program.methods
                .unstake()
                .accounts({
                elizaConfig,
                poolState,
                position,
                positionMint,
                poolAuthority,
                positionVault,
                rewardTokenVault,
                user,
                userTokenAccount,
                userStakeEntry: stakeEntry,
                rewardTokenMint,
                userRewardTokenAccount,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
                .instruction();
            // Send transaction
            const tx = new Transaction().add(unstakeIx);
            const signature = await provider.sendAndConfirm(tx);
            return {
                signature
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to unstake';
            console.error('Unstake error:', err);
            setError(errorMsg);
            throw new Error(errorMsg);
        }
        finally {
            setIsLoading(false);
        }
    }, [program, provider]);
    const claimRewards = useCallback(async (poolState, positionMint, stakeEntry) => {
        if (!program || !provider || !provider.wallet.publicKey) {
            throw new Error('Wallet not connected');
        }
        setIsLoading(true);
        setError(null);
        try {
            const user = provider.wallet.publicKey;
            // Get pool authority
            const [poolAuthority] = PublicKey.findProgramAddressSync([Buffer.from('vault_authority')], program.programId);
            // Get reward token vault
            const [rewardTokenVault] = PublicKey.findProgramAddressSync([Buffer.from('reward_vault'), poolState.toBuffer()], program.programId);
            // Get user reward token account
            const userRewardTokenAccount = getAssociatedTokenAddressSync(rewardTokenMint, user, false, TOKEN_2022_PROGRAM_ID);
            // Check if user reward token account exists
            try {
                await getAccount(provider.connection, userRewardTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
                console.log('Reward token account exists.');
            }
            catch (_a) {
                console.log(`Reward token account not found → creating it`);
                const ataIx = createAssociatedTokenAccountInstruction(user, userRewardTokenAccount, user, rewardTokenMint, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
                await provider.sendAndConfirm(new Transaction().add(ataIx));
            }
            // Create claim rewards instruction
            const claimRewardsIx = await program.methods
                .claimRewards()
                .accounts({
                elizaConfig,
                poolState,
                poolAuthority,
                rewardTokenVault,
                user,
                userStakeEntry: stakeEntry,
                positionMint,
                rewardTokenMint,
                userRewardTokenAccount,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
                .instruction();
            // Send transaction
            const tx = new Transaction().add(claimRewardsIx);
            const signature = await provider.sendAndConfirm(tx);
            // Calculate rewards
            const stakeEntryData = await program.account.stakedPosition.fetch(stakeEntry);
            const rewards = stakeEntryData.rewards.toString();
            return {
                signature,
                rewards
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to claim rewards';
            console.error('Claim rewards error:', err);
            setError(errorMsg);
            throw new Error(errorMsg);
        }
        finally {
            setIsLoading(false);
        }
    }, [program, provider]);
    const increasePoolRewards = useCallback(async (poolState, amount, autoUnpause = null, maxMultiplier = null) => {
        if (!program || !provider || !provider.wallet.publicKey) {
            throw new Error('Wallet not connected');
        }
        setIsLoading(true);
        setError(null);
        try {
            const authority = provider.wallet.publicKey;
            // Get pool authority
            const [poolAuthority] = PublicKey.findProgramAddressSync([Buffer.from('vault_authority')], program.programId);
            // Get reward token vault
            const [rewardTokenVault] = PublicKey.findProgramAddressSync([Buffer.from('reward_vault'), poolState.toBuffer()], program.programId);
            // Get authority reward token account
            const authorityRewardTokenAccount = getAssociatedTokenAddressSync(rewardTokenMint, authority, false, TOKEN_2022_PROGRAM_ID);
            // Check if authority has enough tokens
            const tokenAccount = await getAccount(provider.connection, authorityRewardTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
            if (Number(tokenAccount.amount) < amount) {
                throw new Error(`Insufficient reward tokens. You have ${tokenAccount.amount} but tried to add ${amount}`);
            }
            // Create increase pool rewards instruction
            const increasePoolRewardsIx = await program.methods
                .increasePoolRewards(new BN(amount), autoUnpause !== null ? autoUnpause : null, maxMultiplier !== null ? new BN(maxMultiplier) : null)
                .accounts({
                authority,
                elizaConfig,
                poolState,
                rewardTokenMint,
                poolAuthority,
                rewardTokenVault,
                authorityRewardTokenAccount,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
                .instruction();
            // Send transaction
            const tx = new Transaction().add(increasePoolRewardsIx);
            const signature = await provider.sendAndConfirm(tx);
            return {
                signature
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to increase pool rewards';
            console.error('Increase pool rewards error:', err);
            setError(errorMsg);
            throw new Error(errorMsg);
        }
        finally {
            setIsLoading(false);
        }
    }, [program, provider]);
    const updatePoolConfig = useCallback(async (poolState, params) => {
        if (!program || !provider || !provider.wallet.publicKey) {
            throw new Error('Wallet not connected');
        }
        setIsLoading(true);
        setError(null);
        try {
            const authority = provider.wallet.publicKey;
            // Convert number parameters to BN
            const rewardDuration = params.rewardDuration !== undefined ? new BN(params.rewardDuration) : null;
            const minDepositAmount = params.minDepositAmount !== undefined ? new BN(params.minDepositAmount) : null;
            const maxDepositAmount = params.maxDepositAmount !== undefined ? new BN(params.maxDepositAmount) : null;
            const curveBase = params.curveBase !== undefined ? new BN(params.curveBase) : null;
            const curveSlopeOrExponent = params.curveSlopeOrExponent !== undefined ? new BN(params.curveSlopeOrExponent) : null;
            const pause = params.pause !== undefined ? params.pause : null;
            // Create update pool config instruction
            const updatePoolConfigIx = await program.methods
                .updatePoolConfig(rewardDuration, minDepositAmount, maxDepositAmount, params.isCurveLinear !== undefined ? params.isCurveLinear : null, curveBase, curveSlopeOrExponent, params.newFeeCollector !== undefined ? params.newFeeCollector : null, params.newAuthority !== undefined ? params.newAuthority : null, pause !== null ? pause : null)
                .accounts({
                elizaConfig,
                poolState,
                rewardTokenMint,
                authority,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
                .instruction();
            // Send transaction
            const tx = new Transaction().add(updatePoolConfigIx);
            const signature = await provider.sendAndConfirm(tx);
            return {
                signature
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to update pool config';
            console.error('Update pool config error:', err);
            setError(errorMsg);
            throw new Error(errorMsg);
        }
        finally {
            setIsLoading(false);
        }
    }, [program, provider]);
    const initElizaConfig = useCallback(async () => {
        if (!program || !provider || !provider.wallet.publicKey) {
            throw new Error('Wallet not connected');
        }
        setIsLoading(true);
        setError(null);
        try {
            const authority = provider.wallet.publicKey;
            // Create init eliza config instruction
            const initElizaConfigIx = await program.methods
                .initElizaConfig()
                .accounts({
                authority,
                elizaConfig,
                systemProgram: SystemProgram.programId,
            })
                .instruction();
            // Send transaction
            const tx = new Transaction().add(initElizaConfigIx);
            const signature = await provider.sendAndConfirm(tx);
            return {
                signature
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to initialize Eliza config';
            console.error('Init Eliza config error:', err);
            setError(errorMsg);
            throw new Error(errorMsg);
        }
        finally {
            setIsLoading(false);
        }
    }, [program, provider]);
    const updateElizaConfig = useCallback(async (params) => {
        if (!program || !provider || !provider.wallet.publicKey) {
            throw new Error('Wallet not connected');
        }
        setIsLoading(true);
        setError(null);
        try {
            const authority = provider.wallet.publicKey;
            // Create update eliza config instruction
            const updateElizaConfigIx = await program.methods
                .updateElizaConfig(params.rewardsAuthority !== undefined ? params.rewardsAuthority : null, params.positionHarvestAuthority !== undefined ? params.positionHarvestAuthority : null, params.pauseAllPools !== undefined ? params.pauseAllPools : null)
                .accounts({
                authority,
                elizaConfig,
            })
                .instruction();
            // Send transaction
            const tx = new Transaction().add(updateElizaConfigIx);
            const signature = await provider.sendAndConfirm(tx);
            return {
                signature
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to update Eliza config';
            console.error('Update Eliza config error:', err);
            setError(errorMsg);
            throw new Error(errorMsg);
        }
        finally {
            setIsLoading(false);
        }
    }, [program, provider]);
    const harvestPosition = useCallback(async (poolState, position, positionMint, stakeEntry, whirlpool, tokenMintA, tokenMintB, remainingAccountsInfo) => {
        if (!program || !provider || !provider.wallet.publicKey) {
            throw new Error('Wallet not connected');
        }
        setIsLoading(true);
        setError(null);
        try {
            const authority = provider.wallet.publicKey;
            // Get pool authority
            const [poolAuthority] = PublicKey.findProgramAddressSync([Buffer.from('vault_authority')], program.programId);
            // Get token accounts
            const positionTokenAccount = getAssociatedTokenAddressSync(positionMint, authority, false, TOKEN_2022_PROGRAM_ID);
            const tokenOwnerAccountA = getAssociatedTokenAddressSync(tokenMintA, authority, false, TOKEN_2022_PROGRAM_ID);
            const tokenOwnerAccountB = getAssociatedTokenAddressSync(tokenMintB, authority, false, TOKEN_2022_PROGRAM_ID);
            // Get whirlpool data
            const whirlpoolData = await program.provider.connection.getAccountInfo(whirlpool);
            if (!whirlpoolData) {
                throw new Error('Whirlpool account not found');
            }
            // Parse whirlpool data to get token vaults
            const whirlpoolAccount = await program.account.whirlpool.fetch(whirlpool);
            const tokenVaultA = whirlpoolAccount.tokenVaultA;
            const tokenVaultB = whirlpoolAccount.tokenVaultB;
            // Create harvest position instruction
            const harvestPositionIx = await program.methods
                .harvestPosition(remainingAccountsInfo || null)
                .accounts({
                authority,
                elizaConfig,
                poolAuthority,
                poolState,
                rewardTokenMint,
                userStakeEntry: stakeEntry,
                position,
                positionMint,
                whirlpool,
                positionTokenAccount,
                tokenMintA,
                tokenMintB,
                tokenOwnerAccountA,
                tokenVaultA,
                tokenOwnerAccountB,
                tokenVaultB,
                tokenProgramA: TOKEN_2022_PROGRAM_ID,
                tokenProgramB: TOKEN_2022_PROGRAM_ID,
                memoProgram: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
                whirlpoolProgram: new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'),
            })
                .instruction();
            // Send transaction
            const tx = new Transaction().add(harvestPositionIx);
            const signature = await provider.sendAndConfirm(tx);
            return {
                signature
            };
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to harvest position';
            console.error('Harvest position error:', err);
            setError(errorMsg);
            throw new Error(errorMsg);
        }
        finally {
            setIsLoading(false);
        }
    }, [program, provider]);
    return {
        initPool,
        initStakeEntry,
        stake,
        unstake,
        claimRewards,
        increasePoolRewards,
        updatePoolConfig,
        initElizaConfig,
        updateElizaConfig,
        harvestPosition,
        isLoading,
        error
    };
};
