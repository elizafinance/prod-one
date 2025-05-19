import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSession } from 'next-auth/react';
import { getInitialDefaiForWallet } from '@/lib/airdropDataUtils';
// TODO: Make this configurable, e.g., via environment variable or points.config.ts
const POINT_TO_DEFAI_RATIO = 1; // Assuming 1 AIR point = 1 DeFAI for now
export function useUserAirdrop() {
    const { publicKey, connected } = useWallet();
    const { data: session, status: authStatus } = useSession();
    const [data, setData] = useState({
        initialDefai: null,
        points: null,
        airBasedDefai: null,
        totalDefai: null,
        isLoading: true,
        error: null,
    });
    useEffect(() => {
        async function fetchData() {
            var _a;
            if (authStatus === 'loading') {
                setData(prev => (Object.assign(Object.assign({}, prev), { isLoading: true })));
                return;
            }
            if (authStatus !== 'authenticated' || !((_a = session === null || session === void 0 ? void 0 : session.user) === null || _a === void 0 ? void 0 : _a.walletAddress)) {
                // If not authenticated, we might still want to show initialDefai if a wallet is connected
                // but for now, this hook focuses on the authenticated user context for points.
                // If a wallet is connected but user not authenticated, initialDefai can be fetched, points will be null.
                let initialDefaiForUnauthed = null;
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
            setData(prev => (Object.assign(Object.assign({}, prev), { isLoading: true, error: null })));
            try {
                const initialDefai = getInitialDefaiForWallet(userWalletAddress);
                let userPoints = null;
                // Fetch points from /api/users/my-points
                const pointsResponse = await fetch('/api/users/my-points');
                if (pointsResponse.ok) {
                    const pointsData = await pointsResponse.json();
                    userPoints = pointsData.points;
                }
                else {
                    console.warn('Failed to fetch user points:', await pointsResponse.text());
                    // Keep userPoints as null, error will be set if initialDefai is also null and no data at all
                }
                let airBasedDefaiCalc = null;
                let totalDefaiCalc = null;
                if (userPoints !== null) {
                    airBasedDefaiCalc = userPoints * POINT_TO_DEFAI_RATIO;
                }
                if (initialDefai !== null && airBasedDefaiCalc !== null) {
                    totalDefaiCalc = initialDefai + airBasedDefaiCalc;
                }
                else if (initialDefai !== null) {
                    totalDefaiCalc = initialDefai;
                }
                else if (airBasedDefaiCalc !== null) {
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
            }
            catch (err) {
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
