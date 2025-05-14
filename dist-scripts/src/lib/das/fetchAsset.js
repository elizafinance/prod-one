import useUmiStore from "@/store/useUmiStore";
import { publicKey } from "@metaplex-foundation/umi";
const fetchAsset = async (assetId) => {
    const umi = useUmiStore.getState().umi;
    //@ts-ignore
    return await umi.rpc.getAsset(publicKey(assetId));
};
export default fetchAsset;
