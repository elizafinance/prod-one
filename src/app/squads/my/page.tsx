"use client";

import { useState, useEffect, useCallback } from 'react';
import { useHomePageLogic } from '@/hooks/useHomePageLogic';
import Link from 'next/link';
import { SquadDocument } from '@/lib/mongodb';
import { toast } from 'sonner';
import CreateProposalModal from '@/components/modals/CreateProposalModal';
import { Button } from "@/components/ui/button";
import { TOKEN_LABEL_POINTS } from '@/lib/labels';

interface MySquadData extends SquadDocument {
  totalSquadPoints: number;
}

const PROPOSAL_CREATION_MIN_SQUAD_POINTS = parseInt(process.env.NEXT_PUBLIC_SQUAD_POINTS_TO_CREATE_PROPOSAL || "10000", 10);

export default function MySquadPage() {
  // Use the same logic as the working dashboard
  const {
    session,
    authStatus,
    wallet,
    mySquadData,
    isFetchingSquad,
    userCheckedNoSquad,
    fetchMySquadData,
  } = useHomePageLogic();

  // Local state for this page
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [isLoadingPoints, setIsLoadingPoints] = useState(false);
  const [tierRequirements, setTierRequirements] = useState<{ 
    tiers: Array<{ tier: number, minPoints: number, maxMembers: number }>,
    minRequiredPoints: number 
  } | null>(null);
  const [isFetchingTiers, setIsFetchingTiers] = useState(true);
  const [isCreateProposalModalOpen, setIsCreateProposalModalOpen] = useState(false);

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

  // Fetch user points when needed
  useEffect(() => {
    if (authStatus === "authenticated" && wallet.connected && wallet.publicKey && !isLoadingPoints) {
      if (userPoints === null) {
        fetchUserPoints(wallet.publicKey.toBase58());
      }
    }
  }, [authStatus, wallet.connected, wallet.publicKey, fetchUserPoints, isLoadingPoints, userPoints]);

  const handleForceRefresh = () => {
    if (authStatus === "authenticated" && wallet.connected && wallet.publicKey) {
      fetchMySquadData(wallet.publicKey.toBase58());
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
  
  // Type guard for mySquadData
  const typedSquadData = mySquadData as MySquadData | null;
  const isUserLeader = typedSquadData?.leaderWalletAddress === wallet.publicKey?.toBase58();
  const canCreateProposal = isUserLeader && typedSquadData && typedSquadData.totalSquadPoints >= PROPOSAL_CREATION_MIN_SQUAD_POINTS;

  const handleProposalCreated = () => {
    toast.info('Refreshing squad data after proposal creation...');
    if (wallet.publicKey) {
      fetchMySquadData(wallet.publicKey.toBase58());
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
          
          {!isFetchingSquad && typedSquadData && (
            <div className="text-center space-y-4">
              <div className="p-4 bg-white/80 rounded-lg border border-gray-200">
                <p className="text-lg font-semibold text-gray-800">Name: <span className="text-indigo-600 font-bold">{typedSquadData.name}</span></p>
                {typedSquadData.description && <p className="text-sm text-gray-600 mt-1 italic">&quot;{typedSquadData.description}&quot;</p>}
                <p className="text-sm text-gray-600 mt-2">{TOKEN_LABEL_POINTS}: <span className="font-bold text-green-600">{typedSquadData.totalSquadPoints.toLocaleString()}</span></p>
                <p className="text-sm text-gray-600">Max Members: <span className="font-bold">{getMaxMembersForPoints(typedSquadData.totalSquadPoints)}</span></p>
                
                <div className="mt-3 text-xs bg-indigo-100 p-2 rounded border border-indigo-200">
                  {isUserLeader ? (
                    <p className="text-indigo-700 font-medium">You are the leader of this squad!</p>
                  ) : (
                    <p className="text-indigo-700">Leader: <span className="font-mono">{typedSquadData.leaderWalletAddress.substring(0,6)}...{typedSquadData.leaderWalletAddress.substring(typedSquadData.leaderWalletAddress.length-4)}</span></p>
                  )}
                </div>
              </div>
              
              {/* Proposal Creation Button or Message */}
              {isUserLeader && !canCreateProposal && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-md font-semibold text-blue-600 mb-2">Squad Governance</h4>
                  <p className="text-xs text-gray-500 mb-3">
                    You must have at least {PROPOSAL_CREATION_MIN_SQUAD_POINTS.toLocaleString()} squad points to create a token proposal.<br />
                    Your squad currently has <span className="font-bold text-green-600">{typedSquadData?.totalSquadPoints.toLocaleString()}</span> points.<br />
                    <span className="text-indigo-700 font-medium block mt-2">
                      Need more points? Earn more by completing quests, inviting friends, or buy more DeFAI below.
                    </span>
                    <a
                      href="https://dexscreener.com/solana/3jiwexdwzxjva2yd8aherfsrn7a97qbwmdz8i4q6mh7y"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2"
                    >
                      <Button className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-all">
                        Buy DeFAI
                      </Button>
                    </a>
                  </p>
                  <Button disabled className="w-full py-2.5 bg-gray-300 text-gray-500 font-semibold rounded-lg shadow-none cursor-not-allowed">
                    Create Token Proposal (Locked)
                  </Button>
                </div>
              )}
              {canCreateProposal && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-md font-semibold text-blue-600 mb-2">Squad Governance</h4>
                  <p className="text-xs text-gray-500 mb-3">As squad leader with {typedSquadData?.totalSquadPoints.toLocaleString()} squad points, you can create a token proposal for the AI Reward.</p>
                  <Button 
                    onClick={() => setIsCreateProposalModalOpen(true)} 
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all"
                  >
                    Create Token Proposal
                  </Button>
                </div>
              )}

              <div className="space-y-2 pt-4">
                <Link href={`/squads/${typedSquadData?.squadId}`} passHref>
                  <Button variant="outline" className="w-full border-indigo-500 text-indigo-600 hover:bg-indigo-100">
                    Manage Squad Details
                  </Button>
                </Link>
                
                {!isUserLeader && (
                  <Button variant="destructive" className="w-full">
                    Leave Squad (TODO: Implement)
                  </Button>
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
                          You need at least {minRequiredPoints.toLocaleString()} DeFAI {TOKEN_LABEL_POINTS} to create a new squad.<br/>
                          Your current {TOKEN_LABEL_POINTS}: <span className="font-semibold">{userPoints?.toLocaleString() || '0'}</span>
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {userCheckedNoSquad && (
                    <div className="space-y-2 mt-3">
                      <button 
                        onClick={handleForceRefresh} 
                        className="py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors shadow hover:shadow-md"
                      >
                        Refresh Squad Data
                      </button>
                    </div>
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
            <Button variant="secondary">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {typedSquadData && (
        <CreateProposalModal 
            isOpen={isCreateProposalModalOpen} 
            onClose={() => setIsCreateProposalModalOpen(false)} 
            squadId={typedSquadData.squadId} 
            onProposalCreated={handleProposalCreated} 
        />
      )}
    </main>
  );
} 