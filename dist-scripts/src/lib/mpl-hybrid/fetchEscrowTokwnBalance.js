import useUmiStore from "@/store/useUmiStore";
import { fetchToken, findAssociatedTokenPda, } from "@metaplex-foundation/mpl-toolbox";
import { publicKey } from "@metaplex-foundation/umi";
const fetchEscrowTokenBalance = async () => {
    const escrowAddress = process.env.NEXT_PUBLIC_ESCROW;
    if (!escrowAddress) {
        throw new Error("Escrow address not set in env");
    }
    const tokenMint = process.env.NEXT_PUBLIC_TOKEN;
    if (!tokenMint) {
        throw new Error("Token mint not set in env");
    }
    const umi = useUmiStore.getState().umi;
    const escrowTokenAccountPda = findAssociatedTokenPda(umi, {
        mint: publicKey(tokenMint),
        owner: publicKey(escrowAddress),
    });
    return await fetchToken(umi, escrowTokenAccountPda);
};
export default fetchEscrowTokenBalance;
