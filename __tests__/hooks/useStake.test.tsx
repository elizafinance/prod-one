/**
 * @jest-environment jsdom
 */
// @ts-nocheck
import { renderHook, act } from '@testing-library/react-hooks';
import { useStake } from '@/hooks/useStake';
import { useAnchorProgram } from '@/hooks/useAnchorProgram';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { BN } from '@project-serum/anchor';
import { toast } from 'sonner';
import * as splToken from '@solana/spl-token';

// Mock dependencies
jest.mock('@/hooks/useAnchorProgram');
jest.mock('sonner');
jest.mock('@solana/spl-token', () => ({
  ...jest.requireActual('@solana/spl-token'),
  getAssociatedTokenAddressSync: jest.fn(),
  createAssociatedTokenAccountInstruction: jest.fn(),
  getAccount: jest.fn(),
}));

const mockUseAnchorProgram = useAnchorProgram as jest.Mock;
const mockToastError = toast.error as jest.Mock;
const mockToastSuccess = toast.success as jest.Mock;
const mockGetAssociatedTokenAddressSync = splToken.getAssociatedTokenAddressSync as jest.Mock;
const mockCreateAssociatedTokenAccountInstruction = splToken.createAssociatedTokenAccountInstruction as jest.Mock;
const mockGetAccount = splToken.getAccount as jest.Mock;

describe('useStake Hook', () => {
  let mockProgram: any;
  let mockProvider: any;
  const mockWalletPublicKey = SystemProgram.programId;
  const mockPositionMintAddress = new PublicKey('11111111111111111111111111111112');
  const mockWhirlpoolAddress = new PublicKey('11111111111111111111111111111113');
  const mockUserRewardTokenAccount = new PublicKey('11111111111111111111111111111114');
  const mockUserPositionTokenAccount = new PublicKey('11111111111111111111111111111115');
  const mockUserStakeEntryPDA = new PublicKey('11111111111111111111111111111116');
  const mockElizaProgramId = new PublicKey('1111111111111111111111111111111A');
  const mockPoolAuthPDA = new PublicKey('1111111111111111111111111111111B');

  beforeEach(() => {
    jest.clearAllMocks();

    mockProgram = {
      programId: mockElizaProgramId,
      account: {
        stakedPosition: {
          fetch: jest.fn(),
        },
      },
      methods: {
        initStakeEntry: jest.fn().mockReturnThis(),
        stake: jest.fn().mockReturnThis(),
        accounts: jest.fn().mockReturnThis(),
        accountsStrict: jest.fn().mockReturnThis(),
        instruction: jest.fn().mockResolvedValue({}), // Mock instruction to return a dummy object
      },
    };

    mockProvider = {
      wallet: { publicKey: mockWalletPublicKey },
      connection: { getAccount: jest.fn() }, // Simplified mock
      sendAndConfirm: jest.fn(),
    };

    mockUseAnchorProgram.mockReturnValue({ program: mockProgram, provider: mockProvider });
    mockGetAssociatedTokenAddressSync
      .mockReturnValueOnce(mockUserRewardTokenAccount) // For reward token
      .mockReturnValueOnce(mockUserPositionTokenAccount); // For position token
    
    // Mock findProgramAddressSync for stake entry and pool authority
    jest.spyOn(PublicKey, 'findProgramAddressSync')
      .mockReturnValueOnce([mockUserStakeEntryPDA, 1]) // For userStakeEntryPDA
      .mockReturnValueOnce([mockPoolAuthPDA, 1]); // For poolAuthorityPDA
  });

  it('should return null and toast error if wallet not connected', async () => {
    mockUseAnchorProgram.mockReturnValueOnce({ program: null, provider: null });
    const { result } = renderHook(() => useStake());
    const stakeResult = await act(() => result.current.stake(mockPositionMintAddress, mockWhirlpoolAddress, 3600));
    expect(stakeResult).toBeNull();
    expect(mockToastError).toHaveBeenCalledWith('Wallet not connected');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Wallet not connected');
  });

  it('should return null and toast error if positionMintAddress is missing', async () => {
    const { result } = renderHook(() => useStake());
    // @ts-ignore: Testing invalid input
    const stakeResult = await act(() => result.current.stake(null, mockWhirlpoolAddress, 3600));
    expect(stakeResult).toBeNull();
    expect(mockToastError).toHaveBeenCalledWith('Position Mint and Whirlpool Address are required.');
  });

  it('should successfully stake when stake entry does not exist (needs init)', async () => {
    mockGetAccount.mockRejectedValueOnce(new Error('Account not found')); // Reward ATA needs creation
    mockProgram.account.stakedPosition.fetch.mockRejectedValueOnce(new Error('Account not found')); // Stake entry needs init
    mockProvider.sendAndConfirm.mockResolvedValue('dummySignature');
    mockProgram.account.stakedPosition.fetch.mockResolvedValueOnce({ liquidity: new BN(1000) }); // After stake

    const { result } = renderHook(() => useStake());
    const stakeResult = await act(() => result.current.stake(mockPositionMintAddress, mockWhirlpoolAddress, 86400));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(stakeResult).not.toBeNull();
    expect(stakeResult?.signature).toBe('dummySignature');
    expect(stakeResult?.stakeEntryAddress.equals(mockUserStakeEntryPDA)).toBe(true);
    expect(stakeResult?.stakedAmount.toNumber()).toBe(1000);
    expect(mockToastSuccess).toHaveBeenCalledWith('Successfully staked! Tx: dummySig...');
    expect(mockProgram.methods.initStakeEntry).toHaveBeenCalled();
    expect(mockProgram.methods.stake).toHaveBeenCalled();
    expect(mockProvider.sendAndConfirm).toHaveBeenCalledTimes(1); 
    expect(mockCreateAssociatedTokenAccountInstruction).toHaveBeenCalledTimes(1); // Reward ATA was created
  });

  it('should successfully stake when stake entry already exists', async () => {
    mockGetAccount.mockResolvedValueOnce({}); // Reward ATA exists
    mockProgram.account.stakedPosition.fetch.mockResolvedValueOnce({ someData: 'exists' }); // Stake entry exists
    mockProvider.sendAndConfirm.mockResolvedValue('anotherSignature');
    mockProgram.account.stakedPosition.fetch.mockResolvedValueOnce({ liquidity: new BN(500) }); // After stake

    const { result } = renderHook(() => useStake());
    const stakeResult = await act(() => result.current.stake(mockPositionMintAddress, mockWhirlpoolAddress, 86400));

    expect(stakeResult?.signature).toBe('anotherSignature');
    expect(stakeResult?.stakedAmount.toNumber()).toBe(500);
    expect(mockToastSuccess).toHaveBeenCalledWith('Successfully staked! Tx: anotherS...');
    expect(mockProgram.methods.initStakeEntry).not.toHaveBeenCalled();
    expect(mockCreateAssociatedTokenAccountInstruction).not.toHaveBeenCalled(); // Reward ATA was not created
  });

  it('should handle errors during staking and set error state', async () => {
    mockGetAccount.mockResolvedValueOnce({});
    mockProgram.account.stakedPosition.fetch.mockResolvedValueOnce({});
    mockProvider.sendAndConfirm.mockRejectedValue(new Error('Blockchain RPC Error'));

    const { result } = renderHook(() => useStake());
    const stakeResult = await act(() => result.current.stake(mockPositionMintAddress, mockWhirlpoolAddress, 86400));

    expect(stakeResult).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe('Blockchain RPC Error');
    expect(mockToastError).toHaveBeenCalledWith('Blockchain RPC Error');
  });

}); 