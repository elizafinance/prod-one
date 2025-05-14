import fetchTokenBalance from "@/lib/fetchTokenBalance";
import fetchMetadataByMint, { OffChainJson, CombinedMetadata } from "@/lib/mpl-token-metadata/fetchMetadataByMint";
import { Metadata as OnChainMetadata } from "@metaplex-foundation/mpl-token-metadata"; // Keep for type clarity
import { Token } from "@metaplex-foundation/mpl-toolbox";
import { useEffect, useState } from "react";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import useEscrowStore from "@/store/useEscrowStore";
import { formatTokenAmount } from "@/lib/utils";

// OffChainJson is now imported from fetchMetadataByMint.ts
// No need to redefine OffChainMetadata here unless it needs to be different.

const TokenEscrowSummary = () => {
  const escrow = useEscrowStore.getState().escrow;

  const [escrowTokenAccount, setEscrowTokenAccount] = useState<Token>();
  const [onChainMetadata, setOnChainMetadata] = useState<OnChainMetadata | null>(null);
  const [offChainData, setOffChainData] = useState<OffChainJson | null>(null); // Changed from offChainMetadata to offChainData for clarity
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (escrow && escrow.token) {
      setIsFetching(true);
      setError(null);
      setOffChainData(null); 
      setOnChainMetadata(null); 

      fetchTokenBalance(escrow.token, escrow.publicKey)
        .then((acc) => {
          setEscrowTokenAccount(acc);
          return fetchMetadataByMint(escrow.token); // This now returns CombinedMetadata | null
        })
        .then((combinedMeta) => {
          if (combinedMeta) {
            setOnChainMetadata(combinedMeta.onChain as OnChainMetadata); 
            setOffChainData(combinedMeta.offChain);
          } else {
            // Handle case where fetchMetadataByMint returned null (e.g., Umi not ready or major fetch error)
            setError("Failed to load metadata structure.");
          }
        })
        .catch((err) => {
          console.error("Error fetching token summary data:", err);
          setError(err.message || "Failed to load token data.");
        })
        .finally(() => {
          setIsFetching(false);
        });
    }
  }, [escrow]);

  // Use onChainMetadata for on-chain name/symbol, and offChainData for image/description/etc.
  const displayName = offChainData?.name || (onChainMetadata ? onChainMetadata.name : undefined) || "n/a";
  const displayImage = offChainData?.image;
  // const displaySymbol = (onChainMetadata ? onChainMetadata.symbol : undefined) || offChainData?.symbol || ""; // Example for symbol

  return (
    <Card className="flex flex-col min-h-[300px] p-8 lg:aspect-square">
      <div className="text-xl">Token Escrow</div>
      <div className="flex flex-1 flex-col justify-center w-full items-center gap-4">
        {isFetching ? (
          <Skeleton className="w-24 h-24 rounded-full" />
        ) : displayImage ? (
          <img alt={displayName} src={displayImage} className="w-24 h-24 rounded-full" />
        ) : (
          <Skeleton className="w-24 h-24 rounded-full" /> 
        )}
        <div>Name: {isFetching ? <Skeleton className="h-4 w-20 inline-block" /> : displayName}</div>
        <div>
          Balance:{" "}
          {isFetching ? <Skeleton className="h-4 w-16 inline-block" /> : 
           escrowTokenAccount ? formatTokenAmount(escrowTokenAccount) : "n/a"}
        </div>
        {error && <div className="text-red-500 text-xs mt-2">Error: {error}</div>}
      </div>
    </Card>
  );
};

export default TokenEscrowSummary;
