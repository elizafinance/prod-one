"use client";

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { SquadDocument } from '@/lib/mongodb';
import { toast } from 'sonner';

interface MySquadData extends SquadDocument {}

export default function MySquadPage() {
  const { publicKey, connected } = useWallet();
  const { data: session, status: authStatus } = useSession();
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
    // Skip fetch if already fetching, already determined user has no squad, or already loaded squad data
    if (!userWalletAddress || isFetchingSquad || userCheckedNoSquad || (mySquadData && hasLoadedData)) return;
    
    setIsFetchingSquad(true);
    setError(null);
    console.log("[MySquadPage] Fetching squad data for:", userWalletAddress);
    try {
      const response = await fetch(`/api/squads/my-squad?userWalletAddress=${encodeURIComponent(userWalletAddress)}`);
      const data = await response.json();
      if (response.ok) {
        if (data.squad) {
          console.log("[MySquadPage] Squad data received:", data.squad);
          setMySquadData(data.squad as MySquadData);
          setHasLoadedData(true);
          setUserCheckedNoSquad(false);
        } else {
          console.log("[MySquadPage] User not in a squad or no squad data.");
          setMySquadData(null);
          setHasLoadedData(true);
          setUserCheckedNoSquad(true);
          
          // If user is not in a squad, fetch their points to check eligibility for creating one
          if (userWalletAddress) {
            fetchUserPoints(userWalletAddress);
          }
        }
      } else {
        console.error("[MySquadPage] Failed to fetch squad data:", data.error || response.statusText);
        setError(data.error || response.statusText);
        setMySquadData(null);
        if (response.status === 404) {
          setUserCheckedNoSquad(true);
          setHasLoadedData(true);
          // Also fetch points if we get a 404
          if (userWalletAddress) {
            fetchUserPoints(userWalletAddress);
          }
        }
      }
    } catch (error) {
      console.error("[MySquadPage] Error fetching squad data:", error);
      setError((error as Error).message);
      setMySquadData(null);
      setHasLoadedData(true);
    }
    setIsFetchingSquad(false);
  }, [isFetchingSquad, userCheckedNoSquad, fetchUserPoints, mySquadData, hasLoadedData]);

  useEffect(() => {
    let isActive = true;
    
    // Only fetch if connected with wallet and either:
    // 1. We haven't determined if user has no squad OR
    // 2. We haven't loaded any data yet
    if (connected && publicKey && (!userCheckedNoSquad && !hasLoadedData)) {
      const timer = setTimeout(() => {
        if (isActive) {
          fetchMySquadData(publicKey.toBase58());
        }
      }, 500);
      
      return () => {
        isActive = false;
        clearTimeout(timer);
      };
    }
  }, [connected, publicKey, fetchMySquadData, userCheckedNoSquad, hasLoadedData]);

  useEffect(() => {
    // Reset checks when wallet changes
    if (publicKey) {
      setUserCheckedNoSquad(false);
      setHasLoadedData(false);
    }
  }, [publicKey]);

  const handleForceRefresh = () => {
    if (connected && publicKey) {
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
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-white text-gray-900">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-700">
            Squad Headquarters
          </h1>
          <p className="text-gray-600 mt-2">Join forces with others to rise up the leaderboard and earn extra rewards!</p>
        </div>

        {/* Squad Navigation Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/squads/browse" passHref>
            <div className="bg-indigo-100 hover:bg-indigo-200 border border-indigo-300 rounded-xl p-4 text-center cursor-pointer transform hover:scale-105 transition-all duration-200">
              <h3 className="text-lg font-bold text-indigo-700">Browse Squads</h3>
              <p className="text-xs text-indigo-600 mt-1">Explore squads to join</p>
            </div>
          </Link>
          <Link href="/squads/leaderboard" passHref>
            <div className="bg-purple-100 hover:bg-purple-200 border border-purple-300 rounded-xl p-4 text-center cursor-pointer transform hover:scale-105 transition-all duration-200">
              <h3 className="text-lg font-bold text-purple-700">Squad Leaderboard</h3>
              <p className="text-xs text-purple-600 mt-1">See top-performing squads</p>
            </div>
          </Link>
          <Link href={canCreateSquad && !mySquadData ? "/squads/create" : "#"} passHref>
            <div className={`${canCreateSquad && !mySquadData ? 'bg-green-100 hover:bg-green-200 border border-green-300 cursor-pointer transform hover:scale-105' : 'bg-gray-200 border border-gray-300 cursor-not-allowed'} rounded-xl p-4 text-center transition-all duration-200`}>
              <h3 className={`text-lg font-bold ${canCreateSquad && !mySquadData ? 'text-green-700' : 'text-gray-500'}`}>Create Squad</h3>
              <p className="text-xs text-gray-500 mt-1">{mySquadData ? 'Already in a squad' : `Need ${minRequiredPoints.toLocaleString()} points`}</p>
            </div>
          </Link>
        </div>

        {/* Main My Squad Content */}
        <div className="w-full p-5 bg-indigo-50 border border-indigo-200 rounded-xl shadow-md mb-4">
          <h3 className="text-xl font-bold text-indigo-700 mb-3 text-center">🛡️ My Squad</h3>
          {isFetchingSquad && <p className="text-center text-indigo-600">Loading squad info...</p>}
          {error && <p className="text-center text-red-600 bg-red-100 p-2 rounded border border-red-200">Error: {error}</p>}
          
          {!isFetchingSquad && mySquadData && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-white/80 rounded-lg border border-gray-200">
                <p className="text-lg font-semibold text-gray-800">Name: <span className="text-indigo-600 font-bold">{mySquadData.name}</span></p>
                {mySquadData.description && <p className="text-sm text-gray-600 mt-1 italic">&quot;{mySquadData.description}&quot;</p>}
                <p className="text-sm text-gray-600 mt-2">Points: <span className="font-bold text-green-600">{mySquadData.totalSquadPoints.toLocaleString()}</span></p>
                <p className="text-sm text-gray-600">Members: <span className="font-semibold">{mySquadData.memberWalletAddresses.length} / {process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || 10}</span></p>
                
                <div className="mt-3 text-xs bg-indigo-100 p-2 rounded border border-indigo-200">
                  {isUserLeader ? (
                    <p className="text-indigo-700 font-medium">You are the leader of this squad!</p>
                  ) : (
                    <p className="text-indigo-700">Leader: <span className="font-mono">{mySquadData.leaderWalletAddress.substring(0,6)}...{mySquadData.leaderWalletAddress.substring(mySquadData.leaderWalletAddress.length-4)}</span></p>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <Link href={`/squads/${mySquadData.squadId}`} passHref>
                  <button className="py-2 px-4 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors w-full shadow hover:shadow-md">
                    Manage Squad
                  </button>
                </Link>
                
                {!isUserLeader && (
                  <button className="py-2 px-4 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors w-full shadow hover:shadow-md">
                    Leave Squad
                  </button>
                )}
              </div>
            </div>
          )}
          
          {!isFetchingSquad && !mySquadData && !error && (
            <div className="text-center">
              <div className="p-4 bg-white/80 rounded-lg border border-gray-200 mb-4">
                <p className="text-center text-gray-600 mb-2">You are not currently in a squad.</p>
                <p className="text-sm text-gray-500">Join an existing squad or create your own to earn extra rewards and compete in the leaderboards.</p>
              </div>
              
              {isLoadingPoints ? (
                <div className="flex justify-center items-center py-3">
                  <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="ml-2 text-indigo-700">Checking points...</span>
                </div>
              ) : (
                <>
                  <div className="mt-4 text-center">
                    {canCreateSquad ? (
                      <div className="mb-4 p-3 bg-green-100 rounded-lg border border-green-300">
                        <p className="text-green-800">
                          With {userPoints?.toLocaleString()} points, you&apos;re eligible to create your own squad!
                          <br/>
                          <span className="text-xs mt-1 block text-green-700">
                            Your points allow for: {getMaxMembersForPoints(userPoints)}
                          </span>
                        </p>
                        <Link href="/squads/create" passHref>
                          <button className="mt-2 py-2 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors">
                            Create Your Squad
                          </button>
                        </Link>
                      </div>
                    ) : (
                      <div className="mb-4 p-3 bg-gray-100 rounded-lg border border-gray-300">
                        <p className="text-gray-600">
                          You need at least {minRequiredPoints.toLocaleString()} points to create a squad.<br/>
                          Your current points: <span className="font-semibold">{userPoints?.toLocaleString() || '0'}</span>
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {userCheckedNoSquad && (
                    <button 
                      onClick={handleForceRefresh} 
                      className="py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors shadow hover:shadow-md mt-3"
                    >
                      Refresh Squad Data
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Squad Benefits Info */}
        <div className="w-full max-w-3xl p-5 bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300 rounded-xl shadow-md mt-4 mb-6">
          <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-3 text-center">Squad Benefits</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-3 bg-white/70 rounded-lg border border-gray-200">
              <h4 className="text-md font-bold text-blue-700">🤝 Team Power</h4>
              <p className="text-sm text-gray-700">Combine your points with others to climb higher on the leaderboard</p>
            </div>
            <div className="p-3 bg-white/70 rounded-lg border border-gray-200">
              <h4 className="text-md font-bold text-purple-700">🎁 Bonus Rewards</h4>
              <p className="text-sm text-gray-700">Top squads receive special rewards and early access to features</p>
            </div>
            <div className="p-3 bg-white/70 rounded-lg border border-gray-200">
              <h4 className="text-md font-bold text-pink-700">📈 Growth Boost</h4>
              <p className="text-sm text-gray-700">Squad members get point multipliers on certain actions</p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 text-center">
          <Link href="/">
            <button className="py-2 px-4 bg-gray-500 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors shadow hover:shadow-md">
              Back to Dashboard
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
} 