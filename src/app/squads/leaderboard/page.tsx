"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react'; // To potentially highlight user's squad
import { useRouter } from 'next/navigation'; // Import useRouter

interface SquadLeaderboardEntry {
  squadId: string;
  name: string;
  description?: string;
  leaderWalletAddress: string; // For display or linking
  memberCount: number;
  totalSquadPoints: number;
}

export default function SquadLeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<SquadLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { publicKey } = useWallet();
  const router = useRouter(); // Initialize useRouter
  const currentUserWalletAddress = publicKey?.toBase58();
  // We'd need to fetch the current user's squadId to highlight their squad on this board
  // This could be done by fetching /api/squads/my-squad or from a global user state if available.
  // For now, we'll skip direct highlighting on this page to keep it simpler.

  useEffect(() => {
    const fetchSquadLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/squads/leaderboard');
        if (!response.ok) {
          throw new Error('Failed to fetch squad leaderboard');
        }
        const data = await response.json();
        setLeaderboard(data as SquadLeaderboardEntry[]);
      } catch (err) {
        setError((err as Error).message || 'Could not load squad leaderboard.');
        console.error(err);
      }
      setIsLoading(false);
    };

    fetchSquadLeaderboard();
  }, []);

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-white text-gray-900">
      <div className="w-full max-w-5xl mx-auto py-8 sm:py-12">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-teal-500 via-cyan-600 to-sky-600">
            Squad Rankings
          </h1>
          <Link href="/" passHref>
            <button 
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out whitespace-nowrap"
            >
              Back to Dashboard
            </button>
          </Link>
        </div>

        {isLoading && (
          <div className="text-center py-10">
            <p className="text-xl text-gray-600">Forging the Squad Leaderboard...</p>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-600 mx-auto mt-4"></div>
          </div>
        )}
        {error && <p className="text-center text-red-700 bg-red-100 p-4 rounded-lg border border-red-300">Error: {error}</p>}
        
        {!isLoading && !error && leaderboard.length === 0 && (
          <div className="text-center py-10 bg-gray-100 p-6 rounded-lg shadow-lg border border-gray-200">
            <p className="text-2xl text-gray-700 mb-3">No Squads on the Battlefield Yet!</p>
            <p className="text-gray-600">Be the first to create a squad and dominate the rankings.</p>
          </div>
        )}

        {!isLoading && !error && leaderboard.length > 0 && (
          <div className="overflow-x-auto shadow-xl rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-4 sm:px-6 font-semibold text-gray-600 tracking-wider uppercase text-sm">Rank</th>
                  <th className="text-left py-4 px-4 sm:px-6 font-semibold text-gray-600 tracking-wider uppercase text-sm">Squad Name</th>
                  <th className="text-center py-4 px-4 sm:px-6 font-semibold text-gray-600 tracking-wider uppercase text-sm">Members</th>
                  <th className="text-right py-4 px-4 sm:px-6 font-semibold text-gray-600 tracking-wider uppercase text-sm">Total Points</th>
                  {/* <th className="text-left py-4 px-4 sm:px-6 font-semibold text-gray-300 tracking-wider">Leader</th> */}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaderboard.map((squad, index) => {
                  const rank = index + 1;
                  let rowClasses = "transition-all duration-150 ease-in-out hover:bg-gray-50";
                  // Add styling for top ranks if desired, similar to user leaderboard
                  if (rank === 1) rowClasses = "bg-yellow-50 hover:bg-yellow-100";
                  else if (rank === 2) rowClasses = "bg-slate-100 hover:bg-slate-200";
                  else if (rank === 3) rowClasses = "bg-orange-50 hover:bg-orange-100";

                  return (
                    <tr 
                      key={squad.squadId} 
                      className={rowClasses} 
                      onClick={() => router.push(`/squads/${squad.squadId}`)} 
                      style={{cursor: 'pointer'}}
                    >
                      <td className="py-4 px-4 sm:px-6 font-medium text-gray-700 align-middle">
                        {rank === 1 ? <span className="text-yellow-600 font-semibold">🏆</span> : rank === 2 ? <span className="text-slate-500 font-semibold">🥈</span> : rank === 3 ? <span className="text-orange-500 font-semibold">🥉</span> : ''} {rank}
                      </td>
                      <td className="py-4 px-4 sm:px-6 font-semibold text-lg text-sky-700 hover:text-sky-800 align-middle">{squad.name}</td>
                      <td className="py-4 px-4 sm:px-6 text-center text-gray-600 align-middle">{squad.memberCount}</td>
                      <td className="text-right py-4 px-4 sm:px-6 font-bold text-xl text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-teal-500 align-middle">
                        {squad.totalSquadPoints.toLocaleString()}
                      </td>
                      {/* <td className="py-4 px-4 sm:px-6 font-mono text-xs text-gray-400 align-middle">{squad.leaderWalletAddress.substring(0,6)}...</td> */}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
} 