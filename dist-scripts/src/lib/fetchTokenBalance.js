import useUmiStore from "@/store/useUmiStore";
import { fetchToken, findAssociatedTokenPda, } from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";
const fetchTokenBalance = async (tokenAddress, owner) => {
    const umi = useUmiStore.getState().umi;
    const escrowTokenAccountPda = findAssociatedTokenPda(umi, {
        mint: publicKey(tokenAddress),
        owner: publicKey(owner),
    });
    return fetchToken(umi, escrowTokenAccountPda);
};
export default fetchTokenBalance;
