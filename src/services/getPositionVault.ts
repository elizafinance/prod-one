import { PublicKey } from "@solana/web3.js";

export function getPositionVaultPDA(
  positionMint: PublicKey,
  userStakeEntry: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [positionMint.toBuffer(), userStakeEntry.toBuffer(), Buffer.from('position_vault')],
    programId
  );
}

export const getPositionVaultOrder6 = () => ({ pda: '11111111111111111111111111111111'});