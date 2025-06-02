"use client";

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { SquadDocument } from '@/lib/mongodb';
import { toast } from 'sonner';
import CreateProposalModal from '@/components/modals/CreateProposalModal';
import { Button } from "@/components/ui/button";
import { TOKEN_LABEL_POINTS } from '@/lib/labels';
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Users, Trophy, Zap, Shield, ArrowRight, Plus, UserPlus, Settings } from "lucide-react";

interface MySquadData extends SquadDocument {
  totalSquadPoints: number;
}

const PROPOSAL_CREATION_MIN_SQUAD_POINTS = parseInt(process.env.NEXT_PUBLIC_SQUAD_POINTS_TO_CREATE_PROPOSAL || "10000", 10);

export default function MySquadPage() {
  const { publicKey, connected } = useWallet();
  const { data: session, status: authStatus } = useSession<any>();
  const typedSession: any = session;
  const [mySquadData, setMySquadData] = useState<MySquadData | null>(null);
  const [isFetchingSquad, setIsFetchingSquad] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userCheckedNoSquad, setUserCheckedNoSquad] = useState(false);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  
  // User points for verifying squad creation eligibility
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [isLoadingPoints, setIsLoadingPoints] = useState(false);
  
  // Tier requirements from server
  const [tierRequirements, setTierRequirements] = useState<{ 
    tiers: Array<{ tier: number, minPoints: number, maxMembers: number }>,
    minRequiredPoints: number 
  } | null>(null);
  const [isFetchingTiers, setIsFetchingTiers] = useState(true);

  // Track previous wallet address to detect actual wallet changes
  const [prevWalletAddress, setPrevWalletAddress] = useState<string | null>(null);

  const [isCreateProposalModalOpen, setIsCreateProposalModalOpen] = useState(false);

  // Stable fetch indicator to prevent blinking loops
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const fetchUserPoints = useCallback(async (walletAddress: string) => {
    if (!walletAddress || isLoadingPoints) return;
    setIsLoadingPoints(true);
    
    try {
      const res = await fetch(`/api/users/points?address=${walletAddress}`);
      const data = await res.json();
      if (res.ok && typeof data.points === 'number') {
        setUserPoints(data.points);
      } else {
        // Try fallback to localStorage
        try {
          const stored = localStorage.getItem('defaiUserData');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (typeof parsed.points === 'number') {
              setUserPoints(parsed.points);
            }
          }
        } catch {}
      }
    } catch (err) {
      console.error("Error fetching user points:", err);
    }
    
    setIsLoadingPoints(false);
  }, [isLoadingPoints]);

  const fetchMySquadData = useCallback(async (userWalletAddress: string) => {
    if (authStatus !== "authenticated" || !typedSession?.user?.xId) {
      setError("User not authenticated. Cannot fetch squad data.");
      setIsFetchingSquad(false);
      setHasLoadedData(true);
      setUserCheckedNoSquad(true);
      return;
    }

    if (!userWalletAddress || isFetchingSquad || (userCheckedNoSquad && !isCreateProposalModalOpen) || (mySquadData && hasLoadedData && isCreateProposalModalOpen && !isFetchingSquad)) {
      // Skip if already fetching or determined no squad
      return;
    }
    
    setIsFetchingSquad(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/squads/my-squad?userWalletAddress=${encodeURIComponent(userWalletAddress)}`);
      const data = await response.json();
      if (response.ok) {
        if (data.squad) {
          setMySquadData(data.squad as MySquadData);
          setHasLoadedData(true);
          setUserCheckedNoSquad(false);
        } else {
          setMySquadData(null);
          setHasLoadedData(true);
          setUserCheckedNoSquad(true);
          
          // If user is not in a squad, fetch their points to check eligibility for creating one
          if (userWalletAddress) {
            fetchUserPoints(userWalletAddress);
          }
        }
      } else {
        setError(data.error || response.statusText);
        setMySquadData(null);
        if (response.status === 404 || response.status === 403) {
          setUserCheckedNoSquad(true);
          setHasLoadedData(true);
          // Also fetch points if we get a 404/403 indicating not in squad or mismatch
          if (userWalletAddress) {
            fetchUserPoints(userWalletAddress);
          }
        }
      }
    } catch (error) {
      setError((error as Error).message);
      setMySquadData(null);
      setHasLoadedData(true);
    }
    
    setIsFetchingSquad(false);
  }, [isFetchingSquad, userCheckedNoSquad, fetchUserPoints, mySquadData, hasLoadedData, isCreateProposalModalOpen, authStatus, typedSession?.user?.xId]);

  useEffect(() => {
    let isActive = true;
    let timer: NodeJS.Timeout;
    
    // Very clear guard condition set
    const shouldFetch = 
      // Authentication requirements
      authStatus === "authenticated" && 
      typedSession?.user?.xId && 
      // Wallet requirements
      connected && 
      publicKey && 
      // State requirements - only fetch if we haven't loaded or checked
      (!hasLoadedData || !userCheckedNoSquad) &&
      // Only fetch once per render cycle
      !fetchAttempted &&
      // Not currently fetching
      !isFetchingSquad;
    
    if (shouldFetch) {
      // Mark that we've attempted a fetch for this cycle
      setFetchAttempted(true);
      
      // Add a debounce timer
      timer = setTimeout(() => {
        if (isActive) {
          console.log("[MySquadPage] Fetching squad data for:", publicKey.toBase58());
          fetchMySquadData(publicKey.toBase58());
        }
      }, 500);
    } 
    // Clear case - set definitive state to prevent further attempts
    else if (authStatus === "unauthenticated" || (authStatus === "authenticated" && !typedSession?.user?.xId)) {
      console.log("[MySquadPage] Not authenticated properly, clearing squad data");
      setMySquadData(null);
      setUserCheckedNoSquad(true);
      setHasLoadedData(true);
      setFetchAttempted(true);
    }
    
    return () => {
      isActive = false;
      if (timer) clearTimeout(timer);
    };
  }, [
    authStatus, 
    typedSession?.user?.xId, 
    connected, 
    publicKey, 
    fetchMySquadData,
    userCheckedNoSquad,
    hasLoadedData,
    fetchAttempted,
    isFetchingSquad
  ]);
  
  // Reset fetch attempted when relevant dependencies change
  useEffect(() => {
    if (
      publicKey || // New wallet connected
      authStatus === "authenticated" || // New authentication
      !hasLoadedData || // Data needs to be loaded
      !userCheckedNoSquad // Status needs to be checked
    ) {
      setFetchAttempted(false);
    }
  }, [publicKey, authStatus, hasLoadedData, userCheckedNoSquad]);

  useEffect(() => {
    const currentAddress = publicKey ? publicKey.toBase58() : null;

    if (!connected) {
      setPrevWalletAddress(null);
      // Optionally, reset other states like mySquadData, userCheckedNoSquad, hasLoadedData
      // setMySquadData(null);
      // setUserCheckedNoSquad(false); // Allow re-check on next connection
      // setHasLoadedData(false);
      return;
    }

    if (currentAddress && currentAddress !== prevWalletAddress) {
      setPrevWalletAddress(currentAddress);
      setUserCheckedNoSquad(false);
      setHasLoadedData(false);
      // Explicitly do not call fetchMySquadData here, let the main effect handle it based on auth status
    } else if (!currentAddress && prevWalletAddress) {
      // Wallet was disconnected (publicKey became null)
      setPrevWalletAddress(null);
      // Resetting flags so that on next connect, data can be fetched.
      // setUserCheckedNoSquad(false);
      // setHasLoadedData(false);
      // setMySquadData(null); // Clear stale data
    }
  }, [connected, publicKey, prevWalletAddress]);

  const handleForceRefresh = () => {
    if (authStatus === "authenticated" && connected && publicKey) {
      setUserCheckedNoSquad(false);
      setHasLoadedData(false);
      fetchMySquadData(publicKey.toBase58());
    }
  };

  // Fetch tier requirements from the server
  useEffect(() => {
    async function fetchTierRequirements() {
      setIsFetchingTiers(true);
      try {
        const res = await fetch('/api/squads/tier-requirements');
        const data = await res.json();
        if (res.ok) {
          setTierRequirements(data);
        }
      } catch (err) {
        console.error("Failed to fetch tier requirements:", err);
      }
      setIsFetchingTiers(false);
    }
    
    fetchTierRequirements();
  }, []);

  // Check if the user has enough points to create a squad
  const minRequiredPoints = tierRequirements?.minRequiredPoints || 1000;
  const canCreateSquad = userPoints !== null && userPoints >= minRequiredPoints;
  const isUserLeader = mySquadData?.leaderWalletAddress === publicKey?.toBase58();
  const canCreateProposal = isUserLeader && mySquadData && mySquadData.totalSquadPoints >= PROPOSAL_CREATION_MIN_SQUAD_POINTS;

  const handleProposalCreated = () => {
    toast.info('Refreshing squad data after proposal creation...');
    if (publicKey) {
      // Ensure data is marked as not loaded to trigger fetch
      setHasLoadedData(false);
      setUserCheckedNoSquad(false);
      fetchMySquadData(publicKey.toBase58());
    }
  };

  // Function to determine max members based on points
  const getMaxMembersForPoints = (points: number | null) => {
    if (!points || !tierRequirements?.tiers) return 'Loading...';
    
    // Sort by minPoints descending to check highest tier first
    const sortedTiers = [...tierRequirements.tiers].sort((a, b) => b.minPoints - a.minPoints);
    
    for (const tier of sortedTiers) {
      if (points >= tier.minPoints) {
        return `Up to ${tier.maxMembers} members`;
      }
    }
    
    return 'Not eligible yet';
  };

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">
                  Dashboard
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink href="/squads">
                  Squads
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>My Squad</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Squad Headquarters</h1>
          <div className="flex gap-2">
            <Link href="/squads/browse">
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4 mr-2" />
                Browse Squads
              </Button>
            </Link>
            <Link href="/squads/leaderboard">
              <Button variant="outline" size="sm">
                <Trophy className="h-4 w-4 mr-2" />
                Leaderboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Squad Status</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mySquadData ? 'Active' : 'No Squad'}
              </div>
              <p className="text-xs text-muted-foreground">
                {mySquadData ? `${mySquadData.name}` : 'Join or create a squad'}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Squad Points</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mySquadData ? mySquadData.totalSquadPoints.toLocaleString() : '0'}
              </div>
              <p className="text-xs text-muted-foreground">
                Total accumulated points
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Points</CardTitle>
              <Trophy className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {userPoints !== null ? userPoints.toLocaleString() : '...'}
              </div>
              <p className="text-xs text-muted-foreground">
                Personal contribution
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Max Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mySquadData ? getMaxMembersForPoints(mySquadData.totalSquadPoints).replace('Up to ', '').replace(' members', '') : '...'}
              </div>
              <p className="text-xs text-muted-foreground">
                Based on squad points
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main My Squad Content */}
        <Card>
          <CardHeader>
            <CardTitle>My Squad</CardTitle>
            <CardDescription>
              Manage your squad membership and activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isFetchingSquad && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-destructive/10 p-4 text-destructive">
                <p className="text-sm font-medium">Error: {error}</p>
              </div>
            )}
          
            {!isFetchingSquad && mySquadData && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src="/placeholder.svg" />
                      <AvatarFallback>{mySquadData.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-semibold">{mySquadData.name}</h3>
                      {mySquadData.description && (
                        <p className="text-sm text-muted-foreground mt-1">{mySquadData.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {isUserLeader ? (
                          <Badge variant="default">Squad Leader</Badge>
                        ) : (
                          <Badge variant="secondary">Member</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Link href={`/squads/${mySquadData.squadId}`}>
                    <Button variant="outline">
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Squad
                    </Button>
                  </Link>
                </div>
              
                {/* Proposal Creation Section */}
                {isUserLeader && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Squad Governance</CardTitle>
                      <CardDescription>
                        Create proposals for the AI Reward pool
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {!canCreateProposal ? (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Squad Points Progress</span>
                              <span className="font-medium">{mySquadData.totalSquadPoints.toLocaleString()} / {PROPOSAL_CREATION_MIN_SQUAD_POINTS.toLocaleString()}</span>
                            </div>
                            <Progress 
                              value={(mySquadData.totalSquadPoints / PROPOSAL_CREATION_MIN_SQUAD_POINTS) * 100} 
                              className="h-2"
                            />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Need more points? Complete quests, invite friends, or buy more DeFAI.
                          </p>
                          <div className="flex gap-2">
                            <Button disabled variant="secondary" className="flex-1">
                              Create Token Proposal (Locked)
                            </Button>
                            <a
                              href="https://dexscreener.com/solana/3jiwexdwzxjva2yd8aherfsrn7a97qbwmdz8i4q6mh7y"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button variant="outline">
                                Buy DeFAI
                              </Button>
                            </a>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            As squad leader with {mySquadData.totalSquadPoints.toLocaleString()} squad points, you can create a token proposal.
                          </p>
                          <Button 
                            onClick={() => setIsCreateProposalModalOpen(true)} 
                            className="w-full"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Create Token Proposal
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {!isUserLeader && (
                  <div className="flex justify-end">
                    <Button variant="destructive" size="sm">
                      Leave Squad
                    </Button>
                  </div>
                )}
              </div>
            )}

            {!isFetchingSquad && !mySquadData && !error && (
              <div className="space-y-4">
                <div className="text-center py-8">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">You're not in a squad</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Join an existing squad or create your own to earn extra rewards and compete in the leaderboards.
                  </p>
                </div>
              
                {isLoadingPoints ? (
                  <div className="flex justify-center items-center py-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                    <span className="ml-2 text-sm">Checking points...</span>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {canCreateSquad ? (
                      <Card className="border-green-200 bg-green-50">
                        <CardHeader>
                          <CardTitle className="text-lg">Create Your Squad</CardTitle>
                          <CardDescription>
                            You have {userPoints?.toLocaleString()} points
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm mb-4">
                            Your points allow for: {getMaxMembersForPoints(userPoints)}
                          </p>
                          <Link href="/squads/create">
                            <Button className="w-full">
                              <Plus className="h-4 w-4 mr-2" />
                              Create Squad
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Points Required</CardTitle>
                          <CardDescription>
                            Create your own squad
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Your Points</span>
                              <span className="font-medium">{userPoints?.toLocaleString() || '0'}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Required</span>
                              <span className="font-medium">{minRequiredPoints.toLocaleString()}</span>
                            </div>
                            <Progress 
                              value={(userPoints || 0) / minRequiredPoints * 100} 
                              className="h-2"
                            />
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Join a Squad</CardTitle>
                        <CardDescription>
                          Find squads to join
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm mb-4">
                          Browse existing squads and request to join one that matches your goals.
                        </p>
                        <Link href="/squads/browse">
                          <Button variant="outline" className="w-full">
                            <Users className="h-4 w-4 mr-2" />
                            Browse Squads
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {userCheckedNoSquad && (
                  <div className="flex justify-center mt-4">
                    <Button 
                      onClick={handleForceRefresh} 
                      variant="outline"
                      size="sm"
                    >
                      Refresh Squad Data
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Squad Benefits Info */}
        <Card>
          <CardHeader>
            <CardTitle>Squad Benefits</CardTitle>
            <CardDescription>
              Why you should join or create a squad
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Team Power</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Combine your points with others to climb higher on the leaderboard
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Bonus Rewards</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Top squads receive special rewards and early access to features
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  <h4 className="font-semibold">Growth Boost</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Squad members get point multipliers on certain actions
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {mySquadData && (
        <CreateProposalModal 
            isOpen={isCreateProposalModalOpen} 
            onClose={() => setIsCreateProposalModalOpen(false)} 
            squadId={mySquadData.squadId} 
            onProposalCreated={handleProposalCreated} 
        />
      )}
    </SidebarInset>
  );
} 