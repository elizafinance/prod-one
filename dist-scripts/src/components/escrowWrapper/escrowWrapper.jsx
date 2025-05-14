"use client";
import { toast } from "@/hooks/use-toast";
import fetchEscrow from "@/lib/mpl-hybrid/fetchEscrow";
import useEscrowStore from "@/store/useEscrowStore";
import { useEffect } from "react";
import { Card } from "../ui/card";
import EscrowSettings from "./escowSettings";
import NftEscrow from "./nftEscrowSummary";
import TokenEscrowSummary from "./tokenEscrowSummary";
const EscrowWrapper = () => {
    const escrowData = useEscrowStore().escrow;
    useEffect(() => {
        fetchEscrow()
            .then((escrowData) => {
            useEscrowStore.setState({ escrow: escrowData });
        })
            .catch((error) => toast({ title: "Escrow Error", description: error.message }));
    }, []);
    return (<div className="flex flex-col gap-8 items-center w-full max-w-[1024px] justify-center flex-1 p-8 lg:p-0">
      <div className="flex w-full gap-8 flex-col lg:flex-row">
        <EscrowSettings />
        <TokenEscrowSummary />
      </div>
      <Card className="w-full flex flex-col gap-8 p-8">
        <div className="text-xl">Costs and Fees</div>
        <div className="flex text-center">
          <div className="w-full">
            Token Swap Amount:{" "}
            {escrowData && Number(escrowData.amount).toLocaleString()}
          </div>
          <div className="w-full">
            Token Swap Fee:{" "}
            {escrowData && Number(escrowData.feeAmount).toLocaleString()}
          </div>
          <div className="w-full">
            Sol Swap Fee:{" "}
            {escrowData && Number(escrowData.solFeeAmount).toLocaleString()}
          </div>
        </div>
      </Card>
      <NftEscrow />
    </div>);
};
export default EscrowWrapper;
