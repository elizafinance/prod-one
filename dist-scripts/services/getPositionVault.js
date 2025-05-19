import { PublicKey } from "@solana/web3.js";
import { ELIZA_PROGRAM_ID } from "@/constants/constants"; // Use the .env driven constant
/**
 * Derives the Program-Derived Address (PDA) for a position vault account.
 * This vault is used to store an LP token when it's staked.
 *
 * @param positionMint The mint address of the LP token (e.g., Whirlpool position NFT mint).
 * @param userStakeEntry The address of the user's stake entry account.
 * @param programId The Eliza program ID. Defaults to ELIZA_PROGRAM_ID from constants.
 * @returns A tuple containing the PDA (PublicKey) and the bump seed (number).
 */
export function getPositionVaultPDA(positionMint, userStakeEntry, programId = ELIZA_PROGRAM_ID // Default to the main program ID
) {
    if (!positionMint || !userStakeEntry || !programId) {
        throw new Error("Invalid arguments: positionMint, userStakeEntry, and programId are required.");
    }
    return PublicKey.findProgramAddressSync([
        positionMint.toBuffer(), // Seed 1: LP Token Mint
        userStakeEntry.toBuffer(), // Seed 2: User's Stake Entry Account
        Buffer.from('position_vault') // Seed 3: Constant string "position_vault"
    ], programId);
}
// Remove the placeholder getPositionVaultOrder6 as it's not standard
// export const getPositionVaultOrder6 = () => ({ pda: '11111111111111111111111111111111'});
