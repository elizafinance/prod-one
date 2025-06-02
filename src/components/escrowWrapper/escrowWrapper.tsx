"use client";

import { toast } from "@/hooks/use-toast";
import fetchEscrow from "@/lib/mpl-hybrid/fetchEscrow";
import useEscrowStore from "@/store/useEscrowStore";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Coins, Package } from "lucide-react";
import EscrowSettings from "./escrowSettings";
import NftEscrow from "./nftEscrowSummary";
import TokenEscrowSummary from "./tokenEscrowSummary";

const EscrowWrapper = () => {
  const escrowData = useEscrowStore().escrow;

  useEffect(() => {
    fetchEscrow()
      .then((escrowData) => {
        useEscrowStore.setState({ escrow: escrowData });
      })
      .catch((error) =>
        toast({ 
          title: "Escrow Error", 
          description: error.message,
          variant: "destructive"
        })
      );
  }, []);


  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Escrow Management</h1>
          <p className="text-muted-foreground">
            Manage your MPL hybrid escrow settings and monitor assets
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <Package className="h-3 w-3" />
          MPL Hybrid
        </Badge>
      </div>

      {/* Settings and Token Summary Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <EscrowSettings />
        <TokenEscrowSummary />
      </div>

      {/* Costs and Fees Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Costs and Fees
          </CardTitle>
          <CardDescription>
            Current swap amounts and fee structure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Token Swap Amount</div>
              <div className="text-2xl font-bold">
                {escrowData ? Number(escrowData.amount).toLocaleString() : "--"}
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">Token Swap Fee</div>
              <div className="text-2xl font-bold">
                {escrowData ? Number(escrowData.feeAmount).toLocaleString() : "--"}
              </div>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <div className="text-sm text-muted-foreground mb-1">SOL Swap Fee</div>
              <div className="text-2xl font-bold">
                {escrowData ? Number(escrowData.solFeeAmount).toLocaleString() : "--"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NFT Escrow */}
      <NftEscrow />
    </div>
  );
};

export default EscrowWrapper;
