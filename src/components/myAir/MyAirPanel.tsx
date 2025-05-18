'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
// import { AirSnapshotResponse } from '@/app/api/air/my-snapshot/route'; // Assuming type export
// import { AirNft } from '@/app/api/air/my-nfts/route'; // Assuming type export
import { AIR_NFT_TIERS } from '@/config/airNft.config';
import { toast } from 'sonner'; // For error notifications
import MyAirInfoModal from './MyAirInfoModal';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

// Updated type definitions based on the plan
interface TierCount {
  minted: number;
  available: number; // This might be calculated on frontend from cap - minted or provided by backend
}

interface AirSnapshotResponse {
  wallet: string;
  airPoints: number;
  legacyDefai: number;
  snapshotUnix?: number;
  tierCounts: { [tierId: string]: TierCount }; // e.g., { "1": { minted: 10, available: 2490 }, ... }
  avgBuyPriceUsd?: number;
}

interface AirNft {
  tokenId: string;
  name: string;
  tier: number;
  bonusPct: number;
  imageUrl?: string;
  mintTx?: string;
}

interface MyAirPanelProps {}

const MyAirPanel: React.FC<MyAirPanelProps> = () => {
  const { data: session, status: authStatus } = useSession();
  const [snapshot, setSnapshot] = useState<AirSnapshotResponse | null>(null);
  const [myNfts, setMyNfts] = useState<AirNft[]>([]);
  const [isLoadingSnapshot, setIsLoadingSnapshot] = useState(false);
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);
  const [errorSnapshot, setErrorSnapshot] = useState<string | null>(null);
  const [errorNfts, setErrorNfts] = useState<string | null>(null);
  const [mintingTier, setMintingTier] = useState<number | null>(null);
  const [mintingMessage, setMintingMessage] = useState<string | null>(null);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  const fetchSnapshot = useCallback(async () => {
    if (session?.user?.name) { // Assuming wallet address is part of session or derived
      setIsLoadingSnapshot(true);
      setErrorSnapshot(null);
      try {
        const res = await fetch('/api/air/my-snapshot'); // Real endpoint
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: `Failed to fetch snapshot: ${res.statusText}` }));
          throw new Error(errorData.message || `Failed to fetch snapshot: ${res.statusText}`);
        }
        const data: AirSnapshotResponse = await res.json();
        // Ensure tierCounts is an object, even if API returns null/undefined for it
        data.tierCounts = data.tierCounts || {};
        AIR_NFT_TIERS.forEach(tierInfo => {
          if (!data.tierCounts[String(tierInfo.tier)]) {
            data.tierCounts[String(tierInfo.tier)] = { minted: 0, available: tierInfo.cap };
          } else {
            // Calculate available if not directly provided by backend
             data.tierCounts[String(tierInfo.tier)].available = tierInfo.cap - data.tierCounts[String(tierInfo.tier)].minted;
          }
        });
        setSnapshot(data);
      } catch (e: any) {
        setErrorSnapshot(e.message);
        toast.error(`Snapshot Error: ${e.message}`);
      }
      setIsLoadingSnapshot(false);
    }
  }, [session]);

  const fetchMyNfts = useCallback(async () => {
    if (session?.user?.name) {
      setIsLoadingNfts(true);
      setErrorNfts(null);
      try {
        const res = await fetch('/api/air/my-nfts'); // Real endpoint
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ message: `Failed to fetch NFTs: ${res.statusText}` }));
          throw new Error(errorData.message || `Failed to fetch NFTs: ${res.statusText}`);
        }
        const data: AirNft[] = await res.json();
        setMyNfts(data);
      } catch (e: any) {
        setErrorNfts(e.message);
        toast.error(`NFTs Error: ${e.message}`);
      }
      setIsLoadingNfts(false);
    }
  }, [session]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchSnapshot();
      fetchMyNfts(); // Re-enable fetching NFTs
    }
  }, [authStatus, fetchSnapshot, fetchMyNfts]);

  const handleMintNft = async (tierId: number) => {
    if (!session) {
      toast.error('You must be logged in to mint an NFT.');
      return;
    }
    if (!snapshot || snapshot.airPoints < (AIR_NFT_TIERS.find(t => t.tier === tierId)?.pointsPerNft || Infinity)) {
        toast.error('Insufficient AIR points to mint this NFT.');
        return;
    }
    
    const tierConfig = AIR_NFT_TIERS.find(t => t.tier === tierId);
    if (!tierConfig) {
        toast.error('Invalid NFT tier selected.');
        return;
    }
    const currentTierCounts = snapshot.tierCounts?.[String(tierId)] || { minted: 0, available: tierConfig.cap };
    if (currentTierCounts.minted >= tierConfig.cap) {
        toast.error('This NFT tier has reached its maximum supply.');
        return;
    }

    if (!window.confirm(`Are you sure you want to mint a ${tierConfig.name} AIR NFT for ${tierConfig.pointsPerNft} AIR points?`)) {
        return;
    }

    setMintingTier(tierId);
    setMintingMessage('Minting... please wait.');
    setErrorSnapshot(null); // Clear previous general errors

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
      toast.success(result.message || 'Minting successful! Your new NFT will appear shortly.');
      // Optimistic UI update for points (snapshot will refresh)
      if (snapshot) {
        setSnapshot(prev => prev ? ({...prev, airPoints: prev.airPoints - tierConfig.pointsPerNft}) : null);
      }
      // Refresh data after minting
      fetchSnapshot();
      fetchMyNfts(); 
    } catch (e: any) {
      setErrorSnapshot(e.message); // Display minting error
      toast.error(`Minting Error: ${e.message}`);
      setMintingMessage(null);
    } finally {
      setMintingTier(null);
      setMintingMessage(null); // Clear processing message
    }
  };

  if (authStatus === 'loading') return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <p className="text-center text-lg">Loading session...</p>
    </div>
  );
  if (authStatus !== 'authenticated' || !session) return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <p className="text-center text-lg">Please log in to see your AIR status.</p>
    </div>
  );
  
  // Tier specific styles
  const tierStyles: { [key: number]: string } = {
    1: 'bg-yellow-600/10 border-yellow-600', // Bronze
    2: 'bg-gray-400/10 border-gray-400',    // Silver
    3: 'bg-yellow-400/10 border-yellow-400', // Gold
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-4 sm:p-6 space-y-8">
      {/* Snapshot Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800">My AIR Status</h2>
          <button 
            onClick={() => setIsInfoModalOpen(true)}
            className="p-2 rounded-full hover:bg-gray-200 text-gray-500 hover:text-primary transition-colors"
            title="How AIR works"
          >
            <InformationCircleIcon className="h-7 w-7" />
            <span className="sr-only">How AIR works</span>
          </button>
        </div>
        {isLoadingSnapshot ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-gray-100 p-4 rounded-lg shadow animate-pulse h-32">
                <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-300 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : errorSnapshot ? (
          <p className="text-red-500 bg-red-100 p-3 rounded-md">Could not load AIR status: {errorSnapshot}</p>
        ) : snapshot ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-blue-700">Current AIR Points</h3>
              <p className="text-3xl font-bold text-blue-900">{snapshot.airPoints?.toLocaleString() || '0'}</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-green-700">Legacy DeFAI Balance</h3>
              <p className="text-3xl font-bold text-green-900">{snapshot.legacyDefai?.toLocaleString() || 'N/A'}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg shadow">
              <h3 className="text-sm font-medium text-purple-700">Wallet</h3>
              <p className="text-lg font-semibold text-purple-900 truncate" title={snapshot.wallet}>{snapshot.wallet ? `${snapshot.wallet.substring(0,6)}...${snapshot.wallet.substring(snapshot.wallet.length - 4)}` : 'N/A'}</p>
            </div>
            {snapshot.avgBuyPriceUsd !== undefined && snapshot.avgBuyPriceUsd > 0 && (
                 <div className="bg-indigo-50 p-4 rounded-lg shadow md:col-span-3">
                    <h3 className="text-sm font-medium text-indigo-700">Avg. Legacy Buy Price (USD)</h3>
                    <p className="text-xl font-bold text-indigo-900">${snapshot.avgBuyPriceUsd.toFixed(4)}</p>
                </div>
            )}
          </div>
        ) : (
          <p className="text-gray-500">No snapshot data available.</p>
        )}
      </section>

      <hr className="my-6" />

      {/* Mint AIR NFTs Section */}
      <section>
        <h2 className="text-2xl sm:text-3xl font-semibold mb-4 text-gray-800">Mint AIR NFTs</h2>
        {isLoadingSnapshot ? ( // Use snapshot loading state as it contains points needed for minting
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3].map(i => (
                    <div key={i} className="border border-gray-200 rounded-lg p-4 animate-pulse">
                        <div className="h-5 bg-gray-300 rounded w-1/2 mb-2"></div>
                        <div className="h-3 bg-gray-300 rounded w-3/4 mb-1"></div>
                        <div className="h-3 bg-gray-300 rounded w-2/3 mb-1"></div>
                        <div className="h-3 bg-gray-300 rounded w-1/2 mb-3"></div>
                        <div className="h-8 bg-gray-300 rounded w-full"></div>
                    </div>
                ))}
            </div>
        ) : snapshot && AIR_NFT_TIERS.map(tier => {
          const tierData = snapshot.tierCounts?.[String(tier.tier)] || { minted: 0, available: tier.cap };
          const remainingSupply = tier.cap - tierData.minted;
          const canAfford = snapshot.airPoints >= tier.pointsPerNft;
          const isSoldOut = remainingSupply <= 0;
          const canMint = canAfford && !isSoldOut && !mintingTier;

          return (
            <div key={tier.tier} className={`border rounded-lg p-4 mb-4 shadow-sm ${tierStyles[tier.tier] || 'bg-gray-50 border-gray-200'}`}>
              <h3 className="text-xl font-semibold mb-1 text-gray-700">{tier.name} AIR NFT <span className="text-sm font-normal">(Tier {tier.tier})</span></h3>
              <p className="text-sm text-gray-600">Cost: {tier.pointsPerNft.toLocaleString()} AIR Points</p>
              <p className="text-sm text-gray-600">Bonus: {(tier.bonusPct * 100).toFixed(0)}% (on underlying DEFAI)</p>
              <p className="text-sm text-gray-600">Max Supply: {tier.cap.toLocaleString()}</p>
              <p className={`text-sm font-medium ${remainingSupply > 0 ? 'text-green-600' : 'text-red-600'}`}>
                Remaining: {remainingSupply.toLocaleString()} / {tier.cap.toLocaleString()}
              </p>
              <button
                onClick={() => handleMintNft(tier.tier)}
                disabled={!canMint || mintingTier === tier.tier}
                className={`mt-3 w-full px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${!canMint ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 text-white'}
                  ${mintingTier === tier.tier ? 'opacity-70 cursor-wait' : ''}`}
              >
                {mintingTier === tier.tier ? 'Processing...' : 
                  isSoldOut ? 'Sold Out' : 
                  !canAfford ? 'Insufficient Points' : 
                  'Mint This NFT'}
              </button>
            </div>
          );
        })}
        {mintingMessage && !errorSnapshot && <p className="mt-2 text-center text-blue-600">{mintingMessage}</p>}
      </section>
      
      <hr className="my-6" />

      {/* My Owned AIR NFTs Section */}
      <section>
        <h2 className="text-2xl sm:text-3xl font-semibold mb-4 text-gray-800">My Owned AIR NFTs</h2>
        {isLoadingNfts ? (
            <div className="overflow-x-auto pb-4">
                <div className="flex space-x-4">
                    {[1,2,3].map(i => (
                        <div key={i} className="min-w-[200px] h-48 bg-gray-100 border border-gray-200 rounded-lg p-4 animate-pulse">
                            <div className="h-16 bg-gray-300 rounded mb-2"></div>
                            <div className="h-4 bg-gray-300 rounded w-3/4 mb-1"></div>
                            <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                        </div>
                    ))}
                </div>
            </div>
        ) : errorNfts ? (
          <p className="text-red-500 bg-red-100 p-3 rounded-md">Could not load your NFTs: {errorNfts}</p>
        ) : myNfts.length > 0 ? (
          <div className="overflow-x-auto pb-4">
            <div className="flex space-x-4">
              {myNfts.map(nft => (
                <div key={nft.tokenId} className={`min-w-[220px] border rounded-lg p-4 shadow-md ${tierStyles[nft.tier] || 'bg-gray-50 border-gray-300'}`}>
                  {nft.imageUrl && (
                    <img src={nft.imageUrl} alt={nft.name} className="w-full h-32 object-cover rounded-md mb-2 bg-gray-200" />
                  )}
                  {!nft.imageUrl && (
                    <div className="w-full h-32 bg-gray-200 rounded-md mb-2 flex items-center justify-center text-gray-400">No Image</div>
                  )}
                  <h4 className="text-md font-semibold truncate text-gray-800" title={nft.name}>{nft.name} (Tier {nft.tier})</h4>
                  <p className="text-xs text-gray-600">Bonus: {(nft.bonusPct * 100).toFixed(0)}%</p>
                  <p className="text-xs text-gray-500 truncate" title={nft.tokenId}>Token ID: {nft.tokenId}</p>
                  {nft.mintTx && (
                    <a 
                      href={`https://solscan.io/tx/${nft.mintTx}?cluster=mainnet-beta`} // Adjust cluster as needed
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline mt-1 block"
                    >
                      View Transaction
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 px-4 border-2 border-dashed border-gray-300 rounded-lg">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No AIR NFTs Yet</h3>
            <p className="mt-1 text-sm text-gray-500">Once you mint AIR NFTs, they will appear here.</p>
            {snapshot && snapshot.airPoints > 0 && AIR_NFT_TIERS.some(tier => snapshot.airPoints >= tier.pointsPerNft && (tier.cap - (snapshot.tierCounts?.[String(tier.tier)]?.minted || 0) > 0)) ? (
                 <p className="mt-1 text-sm text-gray-500">You have enough points to mint some now!</p>
            ) : snapshot && snapshot.airPoints > 0 ? (
                 <p className="mt-1 text-sm text-gray-500">Earn more AIR points to mint your first NFT.</p>
            ) : (
                 <p className="mt-1 text-sm text-gray-500">Start by earning AIR points!</p>
            )}
          </div>
        )}
      </section>

      <MyAirInfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />
    </div>
  );
};

export default MyAirPanel; 