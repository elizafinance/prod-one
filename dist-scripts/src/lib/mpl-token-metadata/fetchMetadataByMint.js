import useUmiStore from "@/store/useUmiStore";
import { fetchJsonMetadata, fetchMetadataFromSeeds, } from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";
const fetchMetadataByMint = async (mint) => {
    const umi = useUmiStore.getState().umi;
    const metadata = await fetchMetadataFromSeeds(umi, { mint: publicKey(mint) });
    const JsonMetadata = await fetchJsonMetadata(umi, metadata.uri);
    return {
        ...metadata,
        ...JsonMetadata,
    };
};
export default fetchMetadataByMint;
