import { useEffect, useState } from 'react';
import { useAnchorProgram } from './useAnchorProgram';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

export const useTotalLiquidity = (poolStatePubkey: PublicKey) => {
  const { program } = useAnchorProgram();
  const [totalLiquidity, setTotalLiquidity] = useState<BN | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTotalLiquidity = async () => {
      setLoading(true);
      try {
        const poolStateAccount = await (program as any)?.account.poolState.fetch(poolStatePubkey);
        setTotalLiquidity(poolStateAccount?.totalStakedLiquidity ?? null);
      } catch (err) {
        console.error('Error fetching total liquidity:', err);
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    if (poolStatePubkey) {
      fetchTotalLiquidity();
    }
  }, [program, poolStatePubkey]);

  return { totalLiquidity, loading, error };
};