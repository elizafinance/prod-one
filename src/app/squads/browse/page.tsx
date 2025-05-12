"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { SquadDocument } from '@/lib/mongodb'; // Re-using SquadDocument for the entries

interface SquadBrowseEntry extends SquadDocument {
  memberCount: number; // Added from leaderboard API projection
}

interface MySquadInfo {
  squadId?: string | null;
}

export default function BrowseSquadsPage() {
  const [squads, setSquads] = useState<SquadBrowseEntry[]>([]);
  const [mySquadInfo, setMySquadInfo] = useState<MySquadInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState<string | null>(null); // To track which squad is being joined
  const [error, setError] = useState<string | null>(null);
  const { publicKey, connected } = useWallet();
  const router = useRouter();

  const fetchSquadsAndUserSquad = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch list of squads (using leaderboard endpoint for now)
      const leaderboardResponse = await fetch('/api/squads/leaderboard'); // Or a dedicated /api/squads/list
      if (!leaderboardResponse.ok) {
        throw new Error('Failed to fetch squads list');
      }
      const leaderboardData = await leaderboardResponse.json();
      setSquads(leaderboardData as SquadBrowseEntry[]);

      // Fetch current user's squad status if wallet is connected
      if (connected && publicKey) {
        const mySquadResponse = await fetch(`/api/squads/my-squad?userWalletAddress=${encodeURIComponent(publicKey.toBase58())}`);
        if (mySquadResponse.ok) {
          const mySquadData = await mySquadResponse.json();
          setMySquadInfo({ squadId: mySquadData.squad?.squadId });
        } else {
          setMySquadInfo(null); // Not in a squad or error
        }
      }
    } catch (err) {
      setError((err as Error).message || 'Could not load squads data.');
      console.error(err);
    }
    setIsLoading(false);
  }, [connected, publicKey]);

  useEffect(() => {
    fetchSquadsAndUserSquad();
  }, [fetchSquadsAndUserSquad]);

  const handleJoinSquad = async (squadIdToJoin: string) => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet to join a squad.");
      return;
    }
    if (mySquadInfo?.squadId) {
      toast.info("You are already in a squad. Leave your current squad to join another.");
      return;
    }
    setIsJoining(squadIdToJoin);
    try {
      const response = await fetch('/api/squads/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Backend /api/squads/join now gets userWalletAddress from session
        body: JSON.stringify({ squadIdToJoin }), 
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || `Successfully joined squad!`);
        // Refresh squad list and user's squad status
        fetchSquadsAndUserSquad(); 
        // Optionally redirect to user dashboard or the new squad's page
        router.push('/'); // Go to dashboard, it should reflect the new squad
      } else {
        toast.error(data.error || "Failed to join squad.");
      }
    } catch (err) {
      toast.error("An unexpected error occurred while joining squad.");
      console.error("Join squad error:", err);
    }
    setIsJoining(null);
  };

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="w-full max-w-4xl mx-auto py-8 sm:py-12">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500">
            Join a Squad
          </h1>
          <div className="space-x-3">
            <Link href="/squads/create" passHref>
                <button className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out">
                Create Squad
                </button>
            </Link>
            <Link href="/" passHref>
                <button className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out">
                Back to Dashboard
                </button>
            </Link>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-10"><p className="text-xl text-gray-400">Searching for Squads...</p><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mt-4"></div></div>
        )}
        {error && <p className="text-center text-red-400 bg-red-900 bg-opacity-30 p-4 rounded-lg">Error: {error}</p>}
        
        {!isLoading && !error && squads.length === 0 && (
          <div className="text-center py-10 bg-gray-800 bg-opacity-50 p-6 rounded-lg shadow-xl">
            <p className="text-2xl text-gray-300 mb-3">No squads found. Why not start your own?</p>
          </div>
        )}

        {!isLoading && !error && squads.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {squads.map((squad) => (
              <div key={squad.squadId} className="bg-white/10 backdrop-blur-sm shadow-xl rounded-lg p-6 flex flex-col justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-sky-300 mb-2">{squad.name}</h2>
                  {squad.description && <p className="text-sm text-gray-300 mb-3 h-12 overflow-hidden truncate">{squad.description}</p>}
                  <p className="text-sm text-gray-400">Leader: <span className="font-mono text-xs">{squad.leaderWalletAddress.substring(0,6)}...</span></p>
                  <p className="text-sm text-gray-400">Members: {squad.memberCount} / {process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || 10}</p>
                  <p className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-teal-300 mt-1">Points: {squad.totalSquadPoints.toLocaleString()}</p>
                </div>
                <div className="mt-4 space-y-2">
                  {(!connected || !publicKey) ? (
                    <p className="text-xs text-center text-yellow-400">Connect wallet to join</p>
                  ) : mySquadInfo?.squadId ? (
                    <button 
                      disabled 
                      className="w-full py-2 px-4 bg-gray-500 text-gray-300 font-semibold rounded-lg cursor-not-allowed">
                      Already in a Squad
                    </button>
                  ) : squad.memberCount >= (parseInt(process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || '10')) ? (
                     <button 
                      disabled 
                      className="w-full py-2 px-4 bg-red-700 text-red-300 font-semibold rounded-lg cursor-not-allowed">
                      Squad Full
                    </button>
                  ) : (
                    <button 
                      onClick={() => handleJoinSquad(squad.squadId)}
                      disabled={isJoining === squad.squadId}
                      className="w-full py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg shadow hover:shadow-md transition-colors disabled:opacity-70"
                    >
                      {isJoining === squad.squadId ? 'Joining...' : 'Join Squad'}
                    </button>
                  )}
                  <Link href={`/squads/${squad.squadId}`} passHref>
                     <button className="w-full py-2 px-4 border border-sky-500 text-sky-300 hover:bg-sky-500/20 text-sm font-semibold rounded-lg transition-colors">
                        View Details
                    </button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
} 