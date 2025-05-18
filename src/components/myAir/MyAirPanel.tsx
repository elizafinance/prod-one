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
    fetchMyNfts();
  }, [fetchSnapshot, fetchMyNfts]);

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
    <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px', maxWidth: '600px' }}>
      <h2>My AIR Status</h2>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      
      {isLoadingSnapshot ? <p>Loading AIR snapshot...</p> : snapshot && (
        <div>
          <p><strong>Wallet:</strong> {snapshot.wallet}</p>
          <p><strong>Current AIR Points:</strong> {snapshot.airPoints?.toLocaleString()}</p>
          <p><strong>Legacy DeFAI Balance (Snapshot):</strong> {snapshot.legacyDefai?.toLocaleString()}</p>
          {snapshot.avgBuyPriceUsd !== undefined && <p><strong>Avg. Legacy Buy Price (USD):</strong> ${snapshot.avgBuyPriceUsd?.toFixed(4)}</p>}
        </div>
      )}

      <hr style={{ margin: '20px 0' }} />
      
      <h3>Mint AIR NFTs</h3>
      {snapshot && AIR_NFT_TIERS.map(tier => {
        const canMint = snapshot.airPoints >= tier.pointsPerNft;
        return (
          <div key={tier.tier} style={{ border: '1px solid #eee', padding: '10px', marginBottom: '10px' }}>
            <h4>{tier.name} AIR NFT (Tier {tier.tier})</h4>
            <p>Cost: {tier.pointsPerNft.toLocaleString()} AIR Points</p>
            <p>Bonus: {tier.bonusPct * 100}% (on underlying DEFAI value)</p>
            <p>Max Supply: {tier.cap.toLocaleString()}</p>
            <button 
              onClick={() => handleMintNft(tier.tier)}
              disabled={!canMint || mintingTier === tier.tier || isLoadingSnapshot}
            >
              {mintingTier === tier.tier ? 'Processing...' : canMint ? 'Mint This NFT' : 'Insufficient Points'}
            </button>
          </div>
        );
      })}
      {mintingMessage && <p>{mintingMessage}</p>}

      <hr style={{ margin: '20px 0' }} />

      <h3>My Owned AIR NFTs</h3>
      {isLoadingNfts ? <p>Loading your NFTs...</p> : myNfts.length > 0 ? (
        <ul>
          {myNfts.map(nft => (
            <li key={nft.tokenId}>
              <strong>{nft.name} (Tier {nft.tier})</strong> - Bonus: {nft.bonusPct * 100}%
              {nft.imageUrl && <img src={nft.imageUrl} alt={nft.name} style={{maxWidth: '50px', display: 'block'}}/>}
              <small style={{display: 'block'}}>Token ID: {nft.tokenId}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p>You do not own any AIR NFTs yet, or they are still being processed.</p>
      )}
    </div>
  );
};

export default MyAirPanel; 