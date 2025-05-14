import useUmiStore from "@/store/useUmiStore";
import { fetchEscrowV1 } from "@metaplex-foundation/mpl-hybrid";
import { publicKey } from "@metaplex-foundation/umi";
const fetchEscrow = () => {
    const umi = useUmiStore.getState().umi;
    const escrowAddress = process.env.NEXT_PUBLIC_ESCROW;
    if (!escrowAddress) {
        throw new Error("Escrow address not set in env");
    }
    return fetchEscrowV1(umi, publicKey(escrowAddress));
};
export default fetchEscrow;
