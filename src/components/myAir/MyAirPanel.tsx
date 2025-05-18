'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { AirSnapshotResponse } from '@/app/api/air/my-snapshot/route'; // Assuming type export
import { AirNft } from '@/app/api/air/my-nfts/route'; // Assuming type export
import { AIR_NFT_TIERS } from '@/config/airNft.config';

interface MyAirPanelProps {}

const MyAirPanel: React.FC<MyAirPanelProps> = () => {
  const { data: session, status } = useSession();
  const [snapshot, setSnapshot] = useState<AirSnapshotResponse | null>(null);
  const [myNfts, setMyNfts] = useState<AirNft[]>([]);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mintingTier, setMintingTier] = useState<number | null>(null);
  const [mintingMessage, setMintingMessage] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    if (session) {
      setIsLoadingSnapshot(true);
      setError(null);
      try {
        const res = await fetch('/api/air/my-snapshot');
        if (!res.ok) throw new Error(`Failed to fetch snapshot: ${res.statusText}`);
        const data: AirSnapshotResponse = await res.json();
        setSnapshot(data);
      } catch (e) {
        setError((e as Error).message);
      }
      setIsLoadingSnapshot(false);
    }
  }, [session]);

  const fetchMyNfts = useCallback(async () => {
    if (session) {
      setIsLoadingNfts(true);
      // setError(null); // Keep previous errors if any, or clear per fetch
      try {
        const res = await fetch('/api/air/my-nfts');
        if (!res.ok) throw new Error(`Failed to fetch NFTs: ${res.statusText}`);
        const data: AirNft[] = await res.json();
        setMyNfts(data);
      } catch (e) {
        setError((e as Error).message);
      }
      setIsLoadingNfts(false);
    }
  }, [session]);

  useEffect(() => {
    fetchSnapshot();
    // Skipping NFT fetch until feature is live
  }, [fetchSnapshot]);

  const handleMintNft = async (tierId: number) => {
    if (!session) {
      setMintingMessage('You must be logged in to mint an NFT.');
      return;
    }
    setMintingTier(tierId);
    setMintingMessage('Minting... please wait.');
    setError(null);
    try {
      const res = await fetch('/api/air/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierRequested: tierId }),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || result.message || 'Minting failed');
      }
      setMintingMessage(result.message || 'Minting successful! Your new NFT will appear shortly.');
      // Refresh data after minting
      fetchSnapshot();
      fetchMyNfts(); // Fetch updated NFTs list
    } catch (e) {
      setError((e as Error).message);
      setMintingMessage(null); // Clear minting message on error
    } finally {
      setMintingTier(null);
    }
  };

  if (status === 'loading') return <p>Loading session...</p>;
  if (!session) return <p>Please log in to see your AIR status.</p>;

  return (
    <div className="max-w-3xl mx-auto bg-white shadow-md rounded-lg p-6 space-y-6">
      {/* Placeholder Banner */}
      <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded-md">
        <h2 className="text-lg font-semibold mb-1">Coming Soon – Placeholder Data</h2>
        <p className="text-sm">The information below is mock data while the AIR system is being finalized. Minting and NFT ownership are disabled until launch.</p>
      </div>

      <h2 className="text-2xl font-semibold">My AIR Status</h2>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      
      {isLoadingSnapshot ? <p>Loading AIR snapshot...</p> : snapshot && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <p><strong>Wallet:</strong> {snapshot.wallet}</p>
          <p><strong>Current AIR Points:</strong> {snapshot.airPoints?.toLocaleString()}</p>
          <p><strong>Legacy DeFAI Balance (Snapshot):</strong> {snapshot.legacyDefai?.toLocaleString()}</p>
          {snapshot.avgBuyPriceUsd !== undefined && <p><strong>Avg. Legacy Buy Price (USD):</strong> ${snapshot.avgBuyPriceUsd?.toFixed(4)}</p>}
        </div>
      )}

      <hr className="my-4" />
      
      <h3 className="text-xl font-semibold mb-2">Mint AIR NFTs</h3>
      {AIR_NFT_TIERS.map(tier => {
        const canMint = false; // Disable minting for now
        return (
          <div key={tier.tier} className="border border-border rounded-md p-4 mb-4 bg-muted/10">
            <h4 className="font-medium mb-1">{tier.name} AIR NFT (Tier {tier.tier})</h4>
            <p className="text-sm">Cost: {tier.pointsPerNft.toLocaleString()} AIR Points</p>
            <p className="text-sm">Bonus: {(tier.bonusPct * 100).toFixed(0)}% (on underlying DEFAI value)</p>
            <p className="text-sm mb-2">Max Supply: {tier.cap.toLocaleString()}</p>
            <button
              disabled
              className="cursor-not-allowed bg-gray-300 text-gray-600 px-4 py-2 rounded-md text-sm"
            >
              Mint Coming Soon
            </button>
          </div>
        );
      })}
      {mintingMessage && <p>{mintingMessage}</p>}

      <hr className="my-4" />

      <h3 className="text-xl font-semibold mb-2">My Owned AIR NFTs</h3>
      <p className="text-sm text-muted-foreground">NFT ownership display will be available after launch.</p>
    </div>
  );
};

export default MyAirPanel; 