import { useEffect, useState } from 'react';
import { useAnchorProgram } from './useAnchorProgram';
export const useTotalLiquidity = (poolStatePubkey) => {
    const { program } = useAnchorProgram();
    const [totalLiquidity, setTotalLiquidity] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchTotalLiquidity = async () => {
            var _a;
            setLoading(true);
            try {
                const poolStateAccount = await (program === null || program === void 0 ? void 0 : program.account.poolState.fetch(poolStatePubkey));
                setTotalLiquidity((_a = poolStateAccount === null || poolStateAccount === void 0 ? void 0 : poolStateAccount.totalStakedLiquidity) !== null && _a !== void 0 ? _a : null);
            }
            catch (err) {
                console.error('Error fetching total liquidity:', err);
                setError(err.message);
            }
            finally {
                setLoading(false);
            }
        };
        if (poolStatePubkey) {
            fetchTotalLiquidity();
        }
    }, [program, poolStatePubkey]);
    return { totalLiquidity, loading, error };
};
