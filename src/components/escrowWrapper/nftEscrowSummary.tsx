"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { Package, AlertCircle, Image } from "lucide-react";
import { DasApiAssetList } from "@metaplex-foundation/digital-asset-standard-api";
import fetchEscrowAssets from "@/lib/fetchEscrowAssets";
import NftGrid from "./nftGrid";

const NftEscrow = () => {
  const [escrowAssets, setEscrowAssets] = useState<DasApiAssetList>();
  const [isFetching, setIsFetching] = useState(true);

  const escrowAddress = process.env.NEXT_PUBLIC_ESCROW;

  useEffect(() => {
    fetchEscrowAssets()
      .then((escrowAssets) => {
        setEscrowAssets(escrowAssets);
        setIsFetching(false);
      })
      .catch((error) => {
        console.error("Error fetching escrow assets:", error);
        setIsFetching(false);
      });
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <CardTitle>NFT Escrow</CardTitle>
          </div>
          <Badge variant="outline">
            {isFetching ? (
              <Skeleton className="h-4 w-8" />
            ) : (
              `${escrowAssets?.total || 0} NFTs`
            )}
          </Badge>
        </div>
        <CardDescription>
          NFTs currently held in the escrow contract
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isFetching ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : escrowAssets?.items.length === 0 ? (
          <div className="text-center py-12">
            <Image className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No NFTs in Escrow</h3>
            <p className="text-sm text-muted-foreground">
              The escrow contract currently holds no NFTs
            </p>
          </div>
        ) : escrowAssets ? (
          <NftGrid assets={escrowAssets.items} />
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load NFT data from escrow
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default NftEscrow;
