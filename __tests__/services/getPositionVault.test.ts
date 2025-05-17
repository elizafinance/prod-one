import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getPositionVaultPDA } from '@/services/getPositionVault';
import { ELIZA_PROGRAM_ID } from '@/constants/constants';

describe('getPositionVaultPDA', () => {
  const mockPositionMint = SystemProgram.programId;
  const mockUserStakeEntry = new PublicKey('11111111111111111111111111111112');
  const defaultProgramId = ELIZA_PROGRAM_ID;
  const customProgramId = new PublicKey('11111111111111111111111111111113');

  it('should derive a PDA with the default program ID', () => {
    const [pda, bump] = getPositionVaultPDA(mockPositionMint, mockUserStakeEntry);
    expect(pda).toBeInstanceOf(PublicKey);
    expect(typeof bump).toBe('number');
    // We can't easily check the exact PDA without re-implementing findProgramAddressSync logic here,
    // so we mostly check that it runs and returns the correct types.
  });

  it('should derive a PDA with a custom program ID', () => {
    const [pda, bump] = getPositionVaultPDA(mockPositionMint, mockUserStakeEntry, customProgramId);
    expect(pda).toBeInstanceOf(PublicKey);
    expect(typeof bump).toBe('number');
  });

  it('should throw an error if positionMint is missing', () => {
    expect(() => {
      // @ts-ignore: Testing invalid input
      getPositionVaultPDA(null, mockUserStakeEntry, defaultProgramId);
    }).toThrow('Invalid arguments: positionMint, userStakeEntry, and programId are required.');
  });

  it('should throw an error if userStakeEntry is missing', () => {
    expect(() => {
      // @ts-ignore: Testing invalid input
      getPositionVaultPDA(mockPositionMint, null, defaultProgramId);
    }).toThrow('Invalid arguments: positionMint, userStakeEntry, and programId are required.');
  });

  it('should correctly use the provided seeds for PDA derivation', () => {
    const findProgramAddressSyncSpy = jest.spyOn(PublicKey, 'findProgramAddressSync');
    getPositionVaultPDA(mockPositionMint, mockUserStakeEntry, defaultProgramId);

    expect(findProgramAddressSyncSpy).toHaveBeenCalledWith(
      [
        mockPositionMint.toBuffer(),
        mockUserStakeEntry.toBuffer(),
        Buffer.from('position_vault'),
      ],
      defaultProgramId
    );
    findProgramAddressSyncSpy.mockRestore();
  });
}); 