import { PublicKey } from '@solana/web3.js';

/**
 * Derive the pool state PDA
 * @param whirlpool The whirlpool address
 * @param programId The program ID
 * @returns Tuple of [PDA, bump]
 */
export function getPoolStatePDA(
  whirlpool: PublicKey, 
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool_state'), whirlpool.toBuffer()],
    programId
  );
}

/**
 * Derive the pool authority PDA
 * @param programId The program ID
 * @returns Tuple of [PDA, bump]
 */
export function getPoolAuthorityPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault_authority')],
    programId
  );
}

/**
 * Derive the reward token vault PDA
 * @param poolState The pool state address
 * @param programId The program ID
 * @returns Tuple of [PDA, bump]
 */
export function getRewardTokenVaultPDA(
  poolState: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('reward_vault'), poolState.toBuffer()],
    programId
  );
}

/**
 * Derive the user stake entry PDA
 * @param user The user's public key
 * @param poolState The pool state address
 * @param programId The program ID
 * @returns Tuple of [PDA, bump]
 */
export function getUserStakeEntryPDA(
  user: PublicKey,
  poolState: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [user.toBuffer(), poolState.toBuffer(), Buffer.from('stake_entry')],
    programId
  );
} 