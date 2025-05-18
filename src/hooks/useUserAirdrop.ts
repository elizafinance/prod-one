import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSession } from 'next-auth/react';
import { getInitialDefaiForWallet } from '@/lib/airdropDataUtils';

// TODO: Make this configurable, e.g., via environment variable or points.config.ts
const POINT_TO_DEFAI_RATIO = 1; // Assuming 1 AIR point = 1 DeFAI for now

export interface UserAirdropData {
  initialDefai: number | null;
  points: number | null;
  airBasedDefai: number | null;
  totalDefai: number | null;
  isLoading: boolean;
  error?: string | null;
}

export function useUserAirdrop(): UserAirdropData {
  const { publicKey, connected } = useWallet();
  const { data: session, status: authStatus } = useSession();
  
  const [data, setData] = useState<UserAirdropData>({
    initialDefai: null,
    points: null,
    airBasedDefai: null,
    totalDefai: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    async function fetchData() {
      if (authStatus === 'loading') {
        setData(prev => ({ ...prev, isLoading: true }));
        return;
      }

      if (authStatus !== 'authenticated' || !session?.user?.walletAddress) {
        // If not authenticated, we might still want to show initialDefai if a wallet is connected
        // but for now, this hook focuses on the authenticated user context for points.
        // If a wallet is connected but user not authenticated, initialDefai can be fetched, points will be null.
        let initialDefaiForUnauthed: number | null = null;
        if (connected && publicKey) {
            initialDefaiForUnauthed = getInitialDefaiForWallet(publicKey.toBase58());
        }
        setData({
            initialDefai: initialDefaiForUnauthed,
            points: null,
            airBasedDefai: null,
            totalDefai: initialDefaiForUnauthed,
            isLoading: false,
            error: authStatus !== 'authenticated' ? 'User not authenticated' : null,
        });
        return;
      }

      // User is authenticated, session.user.walletAddress should be reliable
      const userWalletAddress = session.user.walletAddress;
      setData(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const initialDefai = getInitialDefaiForWallet(userWalletAddress);
        let userPoints: number | null = null;

        // Fetch points from /api/users/my-points
        const pointsResponse = await fetch('/api/users/my-points');
        if (pointsResponse.ok) {
          const pointsData = await pointsResponse.json();
          userPoints = pointsData.points as number;
        } else {
          console.warn('Failed to fetch user points:', await pointsResponse.text());
          // Keep userPoints as null, error will be set if initialDefai is also null and no data at all
        }

        let airBasedDefaiCalc: number | null = null;
        let totalDefaiCalc: number | null = null;

        if (userPoints !== null) {
          airBasedDefaiCalc = userPoints * POINT_TO_DEFAI_RATIO;
        }

        if (initialDefai !== null && airBasedDefaiCalc !== null) {
          totalDefaiCalc = initialDefai + airBasedDefaiCalc;
        } else if (initialDefai !== null) {
          totalDefaiCalc = initialDefai;
        } else if (airBasedDefaiCalc !== null) {
          totalDefaiCalc = airBasedDefaiCalc;
        }
        
        setData({
          initialDefai,
          points: userPoints,
          airBasedDefai: airBasedDefaiCalc,
          totalDefai: totalDefaiCalc,
          isLoading: false,
          error: null,
        });

      } catch (err: any) {
        console.error('Error in useUserAirdrop:', err);
        setData({
          initialDefai: null,
          points: null,
          airBasedDefai: null,
          totalDefai: null,
          isLoading: false,
          error: err.message || 'Failed to fetch user airdrop data',
        });
      }
    }

    fetchData();
  }, [publicKey, connected, session, authStatus]);

  return data;
} 