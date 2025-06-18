import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import * as whirlpoolService from '@/services/whirlpool'; // Import all exports
import { WhirlpoolContext, buildWhirlpoolClient, ORCA_WHIRLPOOL_PROGRAM_ID, WhirlpoolData, PositionData } from '@orca-so/whirlpools-sdk';
import { AnchorProvider } from '@project-serum/anchor';
import BN from 'bn.js';

// Mock the Orca SDK parts and AnchorProvider
jest.mock('@orca-so/whirlpools-sdk', () => ({
  // Do not use jest.requireActual to avoid pulling in its internal dependencies like @coral-xyz/anchor
  // const actualSdk = jest.requireActual('@orca-so/whirlpools-sdk'); 
  // return {
  //   ...actualSdk,
  //   WhirlpoolContext: {
  //     withProvider: jest.fn().mockReturnThis(), 
  //   },
  //   buildWhirlpoolClient: jest.fn().mockReturnValue({
  //     getPool: jest.fn(),
  //     getPosition: jest.fn(),
  //   }),
  // };

  // Simpler mock: Only mock what's directly used by the service under test
  ORCA_WHIRLPOOL_PROGRAM_ID: new PublicKey('whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3dSycpA'), 
  buildWhirlpoolClient: jest.fn().mockReturnValue({
    getPool: jest.fn(),
    getPosition: jest.fn(),
  }),
  // Add mock for WhirlpoolContext and its static withProvider method
  WhirlpoolContext: {
    withProvider: jest.fn().mockImplementation((provider, programId) => {
      // Return a mock context object that buildWhirlpoolClient might expect
      // This mock context can be very minimal or more detailed if specific properties are accessed.
      return {
        connection: provider.connection,
        wallet: provider.wallet,
        programId: programId,
        // Potentially other fields if buildWhirlpoolClient needs them from the context
      };
    }),
  },
  // If WhirlpoolContext or other exports are directly used by your service, mock them here too.
  // For now, assuming only buildWhirlpoolClient and ORCA_WHIRLPOOL_PROGRAM_ID (if used) are relevant.
}));

jest.mock('@project-serum/anchor', () => {
  const actualAnchor = jest.requireActual('@project-serum/anchor');
  return {
    ...actualAnchor,
    AnchorProvider: jest.fn().mockImplementation((connection, wallet, opts) => ({
      connection,
      wallet,
      opts,
    })),
  };
});


describe('Whirlpool Service', () => {
  let mockConnection: Connection;
  let mockWhirlpoolAddress: PublicKey;
  let mockPositionAddress: PublicKey;

  // Get the correctly typed mocked client instance from the mock setup
  const mockClientInstance = buildWhirlpoolClient({} as any);

  beforeEach(() => {
    mockConnection = new Connection('http://localhost:8899'); 
    mockWhirlpoolAddress = SystemProgram.programId; 
    mockPositionAddress = new PublicKey('11111111111111111111111111111112'); 
    jest.clearAllMocks();

    // Ensure client mocks are reset for each test if needed, or setup per test
    (mockClientInstance.getPool as jest.Mock).mockClear();
    (mockClientInstance.getPosition as jest.Mock).mockClear();
  });

  describe('fetchWhirlpoolData', () => {
    it('should fetch and return whirlpool data on success', async () => {
      const mockData = { whirlpoolsConfig: new PublicKey(PublicKey.default) } as WhirlpoolData;
      (mockClientInstance.getPool as jest.Mock).mockResolvedValue({ getData: () => mockData });

      const data = await whirlpoolService.fetchWhirlpoolData(mockConnection, mockWhirlpoolAddress);
      expect(data).toEqual(mockData);
      expect(mockClientInstance.getPool).toHaveBeenCalledWith(mockWhirlpoolAddress);
    });

    it('should return null and log error on failure', async () => {
      (mockClientInstance.getPool as jest.Mock).mockRejectedValue(new Error('Fetch failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const data = await whirlpoolService.fetchWhirlpoolData(mockConnection, mockWhirlpoolAddress);
      expect(data).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('fetchPositionData', () => {
    it('should fetch and return position data on success', async () => {
      const mockData = { 
        whirlpool: PublicKey.default,
        positionMint: PublicKey.default,
        liquidity: new BN(100),
        tickLowerIndex: 0,
        tickUpperIndex: 0,
        feeGrowthCheckpointA: new BN(0),
        feeOwedA: new BN(0),
        feeGrowthCheckpointB: new BN(0),
        feeOwedB: new BN(0),
        rewardInfos: []
      } as PositionData; 
      (mockClientInstance.getPosition as jest.Mock).mockResolvedValue({ getData: () => mockData });
      
      const data = await whirlpoolService.fetchPositionData(mockConnection, mockPositionAddress);
      expect(data).toEqual(mockData);
      expect(mockClientInstance.getPosition).toHaveBeenCalledWith(mockPositionAddress);
    });

    it('should return null and log error on failure', async () => {
      (mockClientInstance.getPosition as jest.Mock).mockRejectedValue(new Error('Fetch failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const data = await whirlpoolService.fetchPositionData(mockConnection, mockPositionAddress);
      expect(data).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getPositionLiquidity', () => {
    it('should return liquidity from position data', async () => {
      const mockLiquidity = new BN(12345);
      const mockPosData = { liquidity: mockLiquidity } as PositionData;
      // Set up the mock for client.getPosition which is used by the actual fetchPositionData
      (mockClientInstance.getPosition as jest.Mock).mockResolvedValue({ getData: () => mockPosData });

      const liquidity = await whirlpoolService.getPositionLiquidity(mockConnection, mockPositionAddress);
      expect(liquidity).toBe(12345);
      expect(mockClientInstance.getPosition).toHaveBeenCalledWith(mockPositionAddress); // Verify the underlying call
    });

    it('should return null if position data cannot be fetched', async () => {
      // Make client.getPosition reject, so fetchPositionData (the real one) returns null
      (mockClientInstance.getPosition as jest.Mock).mockRejectedValue(new Error('Fetch failed'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); // Suppress expected error log

      const liquidity = await whirlpoolService.getPositionLiquidity(mockConnection, mockPositionAddress);
      expect(liquidity).toBeNull();
      expect(mockClientInstance.getPosition).toHaveBeenCalledWith(mockPositionAddress);
      expect(consoleErrorSpy).toHaveBeenCalled(); // Ensure the error was logged by fetchPositionData
      consoleErrorSpy.mockRestore();
    });
  });

  describe('fetchPositionRewards', () => {
    it('should return placeholder data and log a warning', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const rewards = await whirlpoolService.fetchPositionRewards(mockConnection, mockPositionAddress, mockWhirlpoolAddress);
      expect(rewards).toEqual({ rewardAmountA: 0, rewardAmountB: 0, otherRewards: [] });
      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });
}); 