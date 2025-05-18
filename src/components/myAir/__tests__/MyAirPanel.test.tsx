import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyAirPanel from '../MyAirPanel';
import { useSession } from 'next-auth/react';
import { AIR_NFT_TIERS } from '@/config/airNft.config';

// Mock the fetch function globally for this test suite
global.fetch = jest.fn();

// Helper to mock fetch responses
const mockFetch = (data: any, ok = true, status = 200) => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    json: async () => data,
    statusText: ok ? 'OK' : 'Error',
  } as Response);
};

// Helper to cast useSession for easier mocking per test
const mockedUseSession = useSession as jest.Mock;

describe('MyAirPanel', () => {
  beforeEach(() => {
    // Reset mocks before each test
    (fetch as jest.Mock).mockClear();
    mockedUseSession.mockClear();

    // Default authenticated session for most tests
    mockedUseSession.mockReturnValue({
      data: {
        user: { walletAddress: 'TEST_WALLET_ADDRESS' },
        expires: new Date(Date.now() + 86400000).toISOString(),
      },
      status: 'authenticated',
    });

    // Default mock successful API responses
    mockFetch({ wallet: 'TEST_WALLET_ADDRESS', airPoints: 1000, legacyDefai: 50 }); // /api/air/my-snapshot
    mockFetch([]); // /api/air/my-nfts (empty array initially)
  });

  test('renders loading session state initially if session status is loading', () => {
    mockedUseSession.mockReturnValueOnce({ data: null, status: 'loading' });
    render(<MyAirPanel />);
    expect(screen.getByText('Loading session...')).toBeInTheDocument();
  });

  test('renders login prompt if session is unauthenticated', () => {
    mockedUseSession.mockReturnValueOnce({ data: null, status: 'unauthenticated' });
    render(<MyAirPanel />);
    expect(screen.getByText('Please log in to see your AIR status.')).toBeInTheDocument();
  });

  test('fetches and displays AIR snapshot data on successful authentication', async () => {
    mockFetch({ wallet: 'TEST_WALLET_ADDRESS_XYZ', airPoints: 12345, legacyDefai: 678 });
    mockFetch([]); 

    render(<MyAirPanel />);

    await waitFor(() => {
      expect(screen.getByText('Current AIR Points:')).toBeInTheDocument();
    });
    expect(screen.getByText('12,345')).toBeInTheDocument(); // Snapshot airPoints
    expect(screen.getByText('678')).toBeInTheDocument();    // Snapshot legacyDefai
    expect(screen.getByText('TEST_WALLET_ADDRESS_XYZ')).toBeInTheDocument(); // Snapshot wallet
    expect(fetch).toHaveBeenCalledWith('/api/air/my-snapshot');
    expect(fetch).toHaveBeenCalledWith('/api/air/my-nfts');
  });

  test('displays available NFT tiers for minting', async () => {
    render(<MyAirPanel />);
    await waitFor(() => expect(screen.getByText(`Mint AIR NFTs`)).toBeInTheDocument());

    for (const tier of AIR_NFT_TIERS) {
      expect(screen.getByText(`${tier.name} AIR NFT (Tier ${tier.tier})`)).toBeInTheDocument();
      expect(screen.getByText(`Cost: ${tier.pointsPerNft.toLocaleString()} AIR Points`)).toBeInTheDocument();
    }
  });

  test('allows minting an NFT if user has enough points', async () => {
    // Snapshot: User has 2000 points
    mockFetch({ wallet: 'TEST_WALLET_ADDRESS', airPoints: 2000, legacyDefai: 50 }); 
    mockFetch([]); // Initial NFTs

    // Mock successful mint response from /api/air/convert
    mockFetch({ 
        message: 'Successfully minted AIR NFT Tier Bronze!', 
        txSignature: 'sim_tx_123', 
        nftId: 'sim_nft_bronze_123' 
    });

    // Mocks for refetching snapshot and NFTs after successful mint
    mockFetch({ wallet: 'TEST_WALLET_ADDRESS', airPoints: 2000 - AIR_NFT_TIERS[0].pointsPerNft, legacyDefai: 50 }); // Updated snapshot
    mockFetch([{ tokenId: 'sim_nft_bronze_123', tier: 1, name: 'Bronze AIR NFT', bonusPct: 0.10 }]); // Updated NFTs list

    const user = userEvent.setup();
    render(<MyAirPanel />);

    // Wait for initial data to load
    await waitFor(() => expect(screen.getByText(`Current AIR Points:`)).toBeInTheDocument());
    expect(screen.getByText('2,000')).toBeInTheDocument();

    // Find the mint button for the first tier (Bronze, costs 500 points)
    const mintButton = screen.getAllByRole('button', { name: /Mint This NFT/i })[0];
    expect(mintButton).not.toBeDisabled();

    await act(async () => {
      await user.click(mintButton);
    });
    
    await waitFor(() => {
        expect(screen.getByText(/Successfully minted AIR NFT Tier Bronze!/i)).toBeInTheDocument();
    });

    // Check if points were updated in UI (2000 - 500 = 1500)
    await waitFor(() => {
        expect(screen.getByText((2000 - AIR_NFT_TIERS[0].pointsPerNft).toLocaleString())).toBeInTheDocument();
    });

    // Check if the new NFT is displayed
    await waitFor(() => {
        expect(screen.getByText(/Bronze AIR NFT \(Tier 1\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Token ID: sim_nft_bronze_123/i)).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith('/api/air/convert', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ tierRequested: AIR_NFT_TIERS[0].tier }),
    }));
  });

  test('disables mint button if user has insufficient points', async () => {
    // Snapshot: User has 100 points, first tier costs 500
    mockFetch({ wallet: 'TEST_WALLET_ADDRESS', airPoints: 100, legacyDefai: 50 });
    mockFetch([]); 

    render(<MyAirPanel />);

    await waitFor(() => expect(screen.getByText(`Current AIR Points:`)).toBeInTheDocument());
    expect(screen.getByText('100')).toBeInTheDocument();

    const mintButton = screen.getAllByRole('button', { name: /Insufficient Points/i })[0];
    expect(mintButton).toBeDisabled();
  });

  test('displays an error message if fetching snapshot fails', async () => {
    (fetch as jest.Mock).mockReset(); // Clear previous general mocks for this specific test
    mockFetch({ error: 'Failed to fetch' }, false, 500); // Mock snapshot fetch failure
    mockFetch([]); // Mock NFT fetch success (or could also fail)

    render(<MyAirPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Error: Failed to fetch snapshot: Error/i)).toBeInTheDocument();
    });
  });

  test('displays an error message if minting fails', async () => {
    mockFetch({ wallet: 'TEST_WALLET_ADDRESS', airPoints: 2000, legacyDefai: 50 });
    mockFetch([]);
    (fetch as jest.Mock).mockImplementationOnce(async (url) => { // Specifically mock the POST call
      if (url === '/api/air/convert') {
        return { 
            ok: false, 
            status: 400, 
            json: async () => ({ error: 'Not enough AIR for this transaction' }),
            statusText: 'Bad Request' 
        };
      }
      return { ok: true, json: async () => ({}), statusText: 'OK' }; // Default for other calls
    });

    const user = userEvent.setup();
    render(<MyAirPanel />);
    await waitFor(() => expect(screen.getByText(`Current AIR Points:`)).toBeInTheDocument());

    const mintButton = screen.getAllByRole('button', { name: /Mint This NFT/i })[0];
    await act(async () => {
      await user.click(mintButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/Error: Not enough AIR for this transaction/i)).toBeInTheDocument();
    });
  });

});
