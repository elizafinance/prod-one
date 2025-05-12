"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react'; // For "You are here" highlight

interface LeaderboardEntry {
  walletAddress: string;
  points: number;
  highestAirdropTierLabel?: string;
}

// Tier styles mapping - customize these Tailwind classes!
const tierStyles: { [key: string]: string } = {
  default: 'bg-gray-500 text-gray-100', // Adjusted for dark theme
  bronze: 'bg-orange-500 text-white border border-orange-400',
  silver: 'bg-slate-400 text-slate-800 border border-slate-500',
  gold: 'bg-yellow-500 text-yellow-900 border border-yellow-600',
  diamond: 'bg-sky-400 text-sky-900 border border-sky-500',
  master: 'bg-indigo-500 text-white border border-indigo-400',
  grandmaster: 'bg-purple-600 text-white border border-purple-500',
  legend: 'bg-pink-600 text-white border border-pink-500 font-bold italic',
};

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { publicKey } = useWallet(); // Get current user's wallet public key
  const currentUserWalletAddress = publicKey?.toBase58();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/users/leaderboard');
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard data. Please try again soon!');
        }
        const data = await response.json();
        setLeaderboard(data);
      } catch (err) {
        setError((err as Error).message || 'Could not load leaderboard data.');
        console.error(err);
      }
      setIsLoading(false);
    };

    fetchLeaderboard();
  }, []);

  // For animated points, consider a library like react-countup
  // Example: <CountUp end={entry.points} duration={1} separator="," />

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="w-full max-w-5xl mx-auto py-8 sm:py-12">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
            Global Rankings
          </h1>
          <Link href="/" passHref>
            <button 
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out whitespace-nowrap"
            >
              Back to Airdrop Checker
            </button>
          </Link>
        </div>

        {isLoading && (
          <div className="text-center py-10">
            <p className="text-xl text-gray-400">Summoning the Leaderboard...</p>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mt-4"></div>
          </div>
        )}
        {error && <p className="text-center text-red-400 bg-red-900 bg-opacity-30 p-4 rounded-lg">Error: {error}</p>}
        
        {!isLoading && !error && leaderboard.length === 0 && (
          <div className="text-center py-10 bg-gray-800 bg-opacity-50 p-6 rounded-lg shadow-xl">
            <p className="text-2xl text-gray-300 mb-3">The Leaderboard Awaits Its Heroes!</p>
            <p className="text-gray-400">Be the first to etch your name and claim the top spot.</p>
          </div>
        )}

        {!isLoading && !error && leaderboard.length > 0 && (
          <div className="overflow-x-auto shadow-2xl rounded-xl backdrop-blur-sm bg-white/5">
            <table className="min-w-full">
              <thead className="border-b border-white/10">
                <tr>
                  <th className="text-left py-4 px-4 sm:px-6 font-semibold text-gray-300 tracking-wider">Rank</th>
                  <th className="text-left py-4 px-4 sm:px-6 font-semibold text-gray-300 tracking-wider">Contender</th>
                  <th className="text-left py-4 px-4 sm:px-6 font-semibold text-gray-300 tracking-wider">Airdrop Tier</th>
                  <th className="text-right py-4 px-4 sm:px-6 font-semibold text-gray-300 tracking-wider">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const isCurrentUser = entry.walletAddress === currentUserWalletAddress;
                  
                  let rankDisplay: React.ReactNode = rank;
                  let rowClasses = "transition-all duration-150 ease-in-out";

                  if (rank === 1) {
                    rankDisplay = <span className="text-yellow-300 text-xl">🏆 {rank}</span>; // Brighter yellow for dark bg
                    rowClasses += " bg-yellow-600/10 hover:bg-yellow-600/20";
                  } else if (rank === 2) {
                    rankDisplay = <span className="text-slate-300 text-lg">🥈 {rank}</span>;
                    rowClasses += " bg-slate-600/10 hover:bg-slate-600/20";
                  } else if (rank === 3) {
                    rankDisplay = <span className="text-orange-400">🥉 {rank}</span>;
                    rowClasses += " bg-orange-600/10 hover:bg-orange-600/20";
                  } else {
                    rowClasses += " hover:bg-gray-700/30";
                  }

                  if (isCurrentUser) {
                    // Ensure current user highlight is distinct and visible on potentially already styled rows
                    rowClasses += " ring-2 ring-purple-400 scale-105 z-10 bg-purple-500/30 shadow-lg"; 
                  }

                  const tierLabel = entry.highestAirdropTierLabel || '-';
                  // Ensure tierStyles access is safe with toLowerCase() only if label exists
                  const tierStyleKey = entry.highestAirdropTierLabel ? entry.highestAirdropTierLabel.toLowerCase() : 'default';
                  const tierStyle = tierStyles[tierStyleKey] || tierStyles.default;

                  return (
                    <tr key={entry.walletAddress + index + rank} className={rowClasses}>
                      <td className="py-4 px-4 sm:px-6 font-medium text-gray-200 align-middle">{rankDisplay}</td>
                      <td className="py-4 px-4 sm:px-6 font-mono text-sm text-gray-300 align-middle">{entry.walletAddress}</td>
                      <td className="py-4 px-4 sm:px-6 align-middle">
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${tierStyle}`}>
                          {tierLabel}
                        </span>
                      </td>
                      <td className="text-right py-4 px-4 sm:px-6 font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 align-middle">
                        {entry.points.toLocaleString()}
                      </td>
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