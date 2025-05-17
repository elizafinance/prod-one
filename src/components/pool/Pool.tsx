"use client";

import React, { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { PublicKey } from "@solana/web3.js";

import { useTotalLiquidity } from "@/hooks/useTotalLiquidity";
import { poolState } from "@/constants/constants";
import { Amount } from "@/components/ui/amount";
import { StakeModal } from "@/components/modals/StakeModal";
import { UnstakeModal } from "@/components/modals/UnstakeModal";
import { Staked } from "@/components/staked/Staked";

// Lazy-load wallet button to avoid SSR issues
const WalletMultiButtonDynamic = dynamic(async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton, { ssr: false });

export const Pool: React.FC = () => {
  const { connection } = useConnection();
  const { connected } = useWallet();

  const { loading, totalLiquidity } = useTotalLiquidity(poolState);

  const [isStakeOpen, setStakeOpen] = useState(false);
  const [isUnstakeOpen, setUnstakeOpen] = useState(false);
  const [stakeEntryAccount, setStakeEntryAccount] = useState<{
    liquidity: bigint;
    pubKey: PublicKey;
  } | null>(null);

  return (
    <div className="border border-muted/30 rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-4">
        <h4 className="font-semibold">Total liquidity:</h4>
        {loading ? (
          <div className="animate-pulse bg-muted h-4 w-24 rounded" />
        ) : (
          <Amount amount={totalLiquidity?.toNumber()} currency="SOL" />
        )}
      </div>

      {stakeEntryAccount ? (
        <Staked
          liquidity={stakeEntryAccount.liquidity.toString()}
          stakeEntry={stakeEntryAccount.pubKey}
        />
      ) : (
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {connected ? (
            <button
              onClick={() => setStakeOpen(true)}
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-5 py-2 text-sm font-medium"
            >
              Stake
            </button>
          ) : (
            <WalletMultiButtonDynamic className="!bg-primary !text-white" />
          )}
          {connected && (
            <button
              onClick={() => setUnstakeOpen(true)}
              className="rounded-full border border-primary text-primary hover:bg-primary/10 px-5 py-2 text-sm font-medium"
            >
              Unstake
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      {isStakeOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 w-full max-w-md">
            <StakeModal setIsStakeModalOpen={setStakeOpen} setStakeEntryAccount={setStakeEntryAccount} />
          </div>
        </div>
      )}

      {isUnstakeOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 w-full max-w-md">
            <UnstakeModal setIsUnstakeModalOpen={setUnstakeOpen} />
          </div>
        </div>
      )}
    </div>
  );
};