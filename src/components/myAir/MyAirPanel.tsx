'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Zap, Wallet, TrendingUp, ExternalLink, Info, Package, Gift } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AIR_NFT_TIERS } from '@/config/airNft.config';
import { toast } from 'sonner';
import MyAirInfoModal from './MyAirInfoModal';

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#3366FF]"></div>
        <p className="ml-2 text-muted-foreground">Loading session...</p>
      </div>
    </div>
  );
  
  if (authStatus !== 'authenticated' || !session) return (
    <div className="p-6 space-y-6">
      <Card>
        <CardContent className="text-center py-8">
          <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Wallet Required</h3>
          <p className="text-muted-foreground">Please connect your wallet to view your AIR status.</p>
        </CardContent>
      </Card>
    </div>
  );
  
  // Tier specific styles for badges
  const getTierBadgeVariant = (tier: number) => {
    switch (tier) {
      case 1: return 'default'; // Bronze
      case 2: return 'secondary'; // Silver
      case 3: return 'outline'; // Gold
      default: return 'outline';
    }
  };

  const getTierColor = (tier: number) => {
    switch (tier) {
      case 1: return 'text-yellow-600'; // Bronze
      case 2: return 'text-gray-500'; // Silver
      case 3: return 'text-yellow-500'; // Gold
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* AIR Status Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                My AIR Status
              </CardTitle>
              <CardDescription>Track your AIR points and legacy balance</CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsInfoModalOpen(true)}
            >
              <Info className="h-4 w-4 mr-2" />
              How AIR Works
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingSnapshot ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1,2,3,4].map(i => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
                    <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-8 bg-muted rounded w-3/4 animate-pulse"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : errorSnapshot ? (
            <Card className="border-destructive">
              <CardContent className="text-center py-6">
                <p className="text-destructive">Could not load AIR status: {errorSnapshot}</p>
              </CardContent>
            </Card>
          ) : snapshot ? (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">AIR Points</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{snapshot.airPoints?.toLocaleString() || '0'}</div>
                  <p className="text-xs text-muted-foreground">Available to mint</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Legacy DeFAI</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{snapshot.legacyDefai?.toLocaleString() || 'N/A'}</div>
                  <p className="text-xs text-muted-foreground">Legacy balance</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Wallet</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold font-mono" title={snapshot.wallet}>
                    {snapshot.wallet ? `${snapshot.wallet.substring(0,6)}...${snapshot.wallet.substring(snapshot.wallet.length - 4)}` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">Connected wallet</p>
                </CardContent>
              </Card>

              {snapshot.avgBuyPriceUsd !== undefined && snapshot.avgBuyPriceUsd > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Avg Buy Price</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-xl font-bold">${snapshot.avgBuyPriceUsd.toFixed(4)}</div>
                    <p className="text-xs text-muted-foreground">USD per token</p>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-6">
                <p className="text-muted-foreground">No snapshot data available.</p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Mint AIR NFTs Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Mint AIR NFTs
          </CardTitle>
          <CardDescription>Convert your AIR points into exclusive NFTs with bonus rewards</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSnapshot ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1,2,3].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <div className="h-5 bg-muted rounded w-1/2 animate-pulse mb-2"></div>
                    <div className="h-3 bg-muted rounded w-3/4 animate-pulse"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded animate-pulse"></div>
                      <div className="h-3 bg-muted rounded animate-pulse"></div>
                      <div className="h-8 bg-muted rounded animate-pulse mt-4"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : snapshot ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {AIR_NFT_TIERS.map(tier => {
                const tierData = snapshot.tierCounts?.[String(tier.tier)] || { minted: 0, available: tier.cap };
                const remainingSupply = tier.cap - tierData.minted;
                const supplyProgress = (tierData.minted / tier.cap) * 100;
                const canAfford = snapshot.airPoints >= tier.pointsPerNft;
                const isSoldOut = remainingSupply <= 0;
                const canMint = canAfford && !isSoldOut && !mintingTier;

                return (
                  <Card key={tier.tier} className={`${isSoldOut ? 'opacity-75' : ''}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{tier.name} NFT</CardTitle>
                        <Badge variant={getTierBadgeVariant(tier.tier)}>
                          Tier {tier.tier}
                        </Badge>
                      </div>
                      <CardDescription className={getTierColor(tier.tier)}>
                        {(tier.bonusPct * 100).toFixed(0)}% bonus on underlying DeFAI
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Cost:</span>
                          <span className="font-medium">{tier.pointsPerNft.toLocaleString()} AIR</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Supply:</span>
                          <span className="font-medium">{remainingSupply.toLocaleString()} / {tier.cap.toLocaleString()}</span>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Minted</span>
                            <span>{Math.round(supplyProgress)}%</span>
                          </div>
                          <Progress value={supplyProgress} className="h-2" />
                        </div>
                      </div>

                      <Button
                        onClick={() => handleMintNft(tier.tier)}
                        disabled={!canMint || mintingTier === tier.tier}
                        className="w-full"
                        variant={canMint ? "default" : "outline"}
                      >
                        {mintingTier === tier.tier ? (
                          <>
                            <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Processing...
                          </>
                        ) : isSoldOut ? (
                          'Sold Out'
                        ) : !canAfford ? (
                          'Insufficient Points'
                        ) : (
                          'Mint This NFT'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-6">
                <p className="text-muted-foreground">Load your AIR status to see available NFTs.</p>
              </CardContent>
            </Card>
          )}
          {mintingMessage && !errorSnapshot && (
            <div className="mt-4 text-center">
              <p className="text-sm text-[#3366FF]">{mintingMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Owned AIR NFTs Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            My AIR NFTs
          </CardTitle>
          <CardDescription>Your collection of minted AIR NFTs</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingNfts ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1,2,3].map(i => (
                <Card key={i}>
                  <CardHeader>
                    <div className="h-32 bg-muted rounded animate-pulse mb-2"></div>
                    <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-3 bg-muted rounded animate-pulse"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : errorNfts ? (
            <Card className="border-destructive">
              <CardContent className="text-center py-6">
                <p className="text-destructive">Could not load your NFTs: {errorNfts}</p>
              </CardContent>
            </Card>
          ) : myNfts.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {myNfts.map(nft => (
                <Card key={nft.tokenId}>
                  <CardHeader className="pb-2">
                    {nft.imageUrl ? (
                      <img 
                        src={nft.imageUrl} 
                        alt={nft.name} 
                        className="w-full h-32 object-cover rounded-md bg-muted" 
                      />
                    ) : (
                      <div className="w-full h-32 bg-muted rounded-md flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold truncate" title={nft.name}>
                          {nft.name}
                        </h4>
                        <Badge variant={getTierBadgeVariant(nft.tier)}>
                          Tier {nft.tier}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {(nft.bonusPct * 100).toFixed(0)}% bonus
                      </p>
                      <p className="text-xs text-muted-foreground font-mono truncate" title={nft.tokenId}>
                        ID: {nft.tokenId}
                      </p>
                      {nft.mintTx && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full" 
                          asChild
                        >
                          <a 
                            href={`https://solscan.io/tx/${nft.mintTx}?cluster=mainnet-beta`}
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3 w-3 mr-2" />
                            View Transaction
                          </a>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No AIR NFTs Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Once you mint AIR NFTs, they will appear here.
                </p>
                {snapshot && snapshot.airPoints > 0 && AIR_NFT_TIERS.some(tier => 
                  snapshot.airPoints >= tier.pointsPerNft && 
                  (tier.cap - (snapshot.tierCounts?.[String(tier.tier)]?.minted || 0) > 0)
                ) ? (
                  <p className="text-sm text-[#3366FF] font-medium">
                    You have enough points to mint some now!
                  </p>
                ) : snapshot && snapshot.airPoints > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Earn more AIR points to mint your first NFT.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Start by earning AIR points!
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <MyAirInfoModal isOpen={isInfoModalOpen} onClose={() => setIsInfoModalOpen(false)} />
    </div>
  );
};

export default MyAirPanel;