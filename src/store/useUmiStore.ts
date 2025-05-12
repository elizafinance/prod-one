import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import {
  Signer,
  Umi,
  createNoopSigner,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { createSignerFromWalletAdapter } from "@metaplex-foundation/umi-signer-wallet-adapters";
import { WalletAdapter } from "@solana/wallet-adapter-base";
import { create } from "zustand";

interface UmiState {
  umi: Umi;
  signer: Signer | undefined;
  updateSigner: (signer: WalletAdapter) => void;
}

// Determine the most appropriate RPC URL
const getRpcUrl = (): string => {
  const heliusUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
  const solanaUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  const defaultRpc = process.env.NEXT_PUBLIC_RPC;
  
  // Use the first available URL, prioritizing Helius
  const rpcUrl = heliusUrl || solanaUrl || defaultRpc || "https://api.devnet.solana.com";
  
  // Validate URL format
  if (!rpcUrl.startsWith('http://') && !rpcUrl.startsWith('https://')) {
    console.error('Invalid RPC URL format:', rpcUrl);
    return "https://api.devnet.solana.com"; // Fallback to devnet
  }
  
  return rpcUrl;
};

const useUmiStore = create<UmiState>()((set) => ({
  umi: createUmi(getRpcUrl())
    .use(
      signerIdentity(
        createNoopSigner(publicKey("11111111111111111111111111111111"))
      )
    )
    .use(dasApi())
    .use(mplTokenMetadata()),
  signer: undefined,
  updateSigner: (signer) => {
    set(() => ({ signer: createSignerFromWalletAdapter(signer) }));
  },
}));

export default useUmiStore;
