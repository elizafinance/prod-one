import fetchTokenBalance from "@/lib/fetchTokenBalance";
import fetchMetadataByMint, { OffChainJson, CombinedMetadata } from "@/lib/mpl-token-metadata/fetchMetadataByMint";
import { Metadata as OnChainMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { Token } from "@metaplex-foundation/mpl-toolbox";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { Coins, AlertCircle, Wallet } from "lucide-react";
import useEscrowStore from "@/store/useEscrowStore";
import { formatTokenAmount } from "@/lib/utils";


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
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Token Escrow
        </CardTitle>
        <CardDescription>
          Token metadata and balance information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center space-y-4">
          {/* Token Image */}
          <div className="relative">
            {isFetching ? (
              <Skeleton className="w-20 h-20 rounded-full" />
            ) : displayImage ? (
              <div className="relative">
                <img 
                  alt={displayName} 
                  src={displayImage} 
                  className="w-20 h-20 rounded-full object-cover border-2 border-border" 
                />
                <div className="absolute -bottom-1 -right-1">
                  <Badge variant="secondary" className="h-6 w-6 rounded-full p-0 flex items-center justify-center">
                    <Wallet className="h-3 w-3" />
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-border">
                <Coins className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Token Details */}
          <div className="text-center space-y-2 w-full">
            <div>
              <div className="text-sm text-muted-foreground">Token Name</div>
              <div className="font-medium">
                {isFetching ? <Skeleton className="h-4 w-24 mx-auto" /> : displayName}
              </div>
            </div>
            
            <div className="pt-2">
              <div className="text-sm text-muted-foreground mb-1">Escrow Balance</div>
              <div className="text-lg font-bold">
                {isFetching ? (
                  <Skeleton className="h-6 w-20 mx-auto" />
                ) : escrowTokenAccount ? (
                  formatTokenAmount(escrowTokenAccount)
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="w-full">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {error}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TokenEscrowSummary;
