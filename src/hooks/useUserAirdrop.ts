import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSession } from 'next-auth/react';
import { getInitialDefaiForWallet } from '@/lib/airdropDataUtils';

// Get airdrop pool size from environment variable
const airdropPoolSize = parseInt(process.env.NEXT_PUBLIC_AIRDROP_POINTS_POOL_SIZE || '1000000000', 10);

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
        let totalCommunityPoints: number | null = null;

        // Fetch points and total community points in parallel
        const [pointsResponse, totalPointsResponse] = await Promise.allSettled([
          fetch('/api/users/my-points'),
          fetch('/api/stats/total-points')
        ]);

        if (pointsResponse.status === 'fulfilled' && pointsResponse.value.ok) {
          const pointsData = await pointsResponse.value.json();
          userPoints = pointsData.points as number;
        } else {
          console.warn('Failed to fetch user points');
        }

        if (totalPointsResponse.status === 'fulfilled' && totalPointsResponse.value.ok) {
          const totalPointsData = await totalPointsResponse.value.json();
          totalCommunityPoints = totalPointsData.totalCommunityPoints > 0 ? totalPointsData.totalCommunityPoints : null;
        } else {
          console.warn('Failed to fetch total community points');
        }

        let airBasedDefaiCalc: number | null = null;
        let totalDefaiCalc: number | null = null;

        // Calculate proportional share of the airdrop pool
        if (userPoints !== null && userPoints > 0 && totalCommunityPoints !== null && totalCommunityPoints > 0) {
          airBasedDefaiCalc = (userPoints / totalCommunityPoints) * airdropPoolSize;
        } else if (userPoints !== null && userPoints === 0) {
          airBasedDefaiCalc = 0;
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