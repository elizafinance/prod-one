import useUmiStore from "@/store/useUmiStore";
import {
  fetchJsonMetadata,
  fetchMetadataFromSeeds,
  Metadata as OnChainMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { publicKey } from "@metaplex-foundation/umi";

export interface OffChainJson {
  name?: string;
  symbol?: string;
  description?: string;
  image?: string;
  attributes?: any[];
}

export interface CombinedMetadata {
  onChain: OnChainMetadata;
  offChain: OffChainJson | null;
}

const fetchMetadataByMint = async (mint: string): Promise<CombinedMetadata | null> => {
  const umi = useUmiStore.getState().umi;
  if (!umi) {
    console.error("Umi instance is not available.");
    return null;
  }

  try {
    const metadataAccount = await fetchMetadataFromSeeds(umi, { mint: publicKey(mint) });
    let offChainJson: OffChainJson | null = null;

    if (metadataAccount && metadataAccount.uri) {
      try {
        offChainJson = await fetchJsonMetadata(umi, metadataAccount.uri);
      } catch (e) {
        console.warn(`Failed to fetch or parse JSON metadata from URI: ${metadataAccount.uri}`, e);
      }
    }
    
    return {
      onChain: metadataAccount,
      offChain: offChainJson,
    };
  } catch (error) {
    console.error(`Failed to fetch metadata for mint ${mint}:`, error);
    return null;
  }
};

export default fetchMetadataByMint;
