"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface LeaderboardEntry {
  walletAddress: string;
  points: number;
  highestAirdropTierLabel?: string;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/users/leaderboard');
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard');
        }
        const data = await response.json();
        setLeaderboard(data);
      } catch (err) {
        setError((err as Error).message || 'Could not load leaderboard.');
        console.error(err);
      }
      setIsLoading(false);
    };

    fetchLeaderboard();
  }, []);

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-white text-gray-900">
      <div className="w-full max-w-4xl mx-auto py-8 sm:py-12">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold font-spacegrotesk text-black">Leaderboard</h1>
          <Link href="/" passHref>
            <button 
              className="text-white font-semibold py-2 px-4 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap"
              style={{ backgroundColor: '#2563EB' }}
            >
              Back to Airdrop Checker
            </button>
          </Link>
        </div>

        {isLoading && <p className="text-center text-gray-700">Loading leaderboard...</p>}
        {error && <p className="text-center text-red-500">Error: {error}</p>}
        
        {!isLoading && !error && leaderboard.length === 0 && (
          <p className="text-center text-gray-700">Leaderboard is currently empty. Be the first to earn points!</p>
        )}

        {!isLoading && !error && leaderboard.length > 0 && (
          <div className="overflow-x-auto shadow-lg rounded-lg">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-200 text-gray-700">
                <tr>
                  <th className="text-left py-3 px-4 sm:px-6 font-semibold">Rank</th>
                  <th className="text-left py-3 px-4 sm:px-6 font-semibold">Wallet Address</th>
                  <th className="text-left py-3 px-4 sm:px-6 font-semibold">Tier</th>
                  <th className="text-right py-3 px-4 sm:px-6 font-semibold">Points</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {leaderboard.map((entry, index) => (
                  <tr key={entry.walletAddress + index} className={`${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100 transition-colors`}>
                    <td className="text-left py-3 px-4 sm:px-6">{index + 1}</td>
                    <td className="text-left py-3 px-4 sm:px-6 font-mono text-sm">{entry.walletAddress}</td>
                    <td className="text-left py-3 px-4 sm:px-6">
                      {entry.highestAirdropTierLabel ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                          {entry.highestAirdropTierLabel}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="text-right py-3 px-4 sm:px-6 font-semibold">{entry.points.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
} 