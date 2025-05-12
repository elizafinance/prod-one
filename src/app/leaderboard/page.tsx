"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react'; // For "You are here" highlight
import GlowingBadge from '@/components/GlowingBadge';
import UserAvatar from '@/components/UserAvatar';

interface LeaderboardEntry {
  walletAddress: string;
  points: number;
  highestAirdropTierLabel?: string;
  xUsername?: string;
  xProfileImageUrl?: string;
  earnedBadgeIds?: string[];
}

// Tier styles mapping - customize these Tailwind classes!
const tierStyles: { [key: string]: string } = {
  default: 'bg-gray-300 text-gray-800', // Adjusted for light theme
  bronze: 'bg-orange-500 text-white border border-orange-600',
  silver: 'bg-slate-400 text-slate-900 border border-slate-500',
  gold: 'bg-yellow-400 text-yellow-900 border border-yellow-500', // Adjusted gold for better visibility
  diamond: 'bg-sky-400 text-sky-900 border border-sky-500',
  master: 'bg-indigo-500 text-white border border-indigo-600',
  grandmaster: 'bg-purple-600 text-white border border-purple-700',
  legend: 'bg-pink-600 text-white border border-pink-700 font-bold italic',
};

// Badge styles mapping
const badgeDisplayMap: { [key: string]: { icon: string; label: string; color: string; isSpecial?: boolean; glowColor?: string } } = {
  pioneer_badge: { icon: "🧭", label: "Pioneer", color: "bg-green-600 text-white" }, // Slightly darker green
  legend_tier_badge: { icon: "🌟", label: "Legend Tier", color: "bg-yellow-500 text-black" },
  generous_donor_badge: { 
    icon: "✨", 
    label: "Generous Donor", 
    color: "bg-violet-600 text-white", 
    isSpecial: true,
    glowColor: "rgba(139, 92, 246, 0.7)" // Purple glow remains suitable
  },
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

  // Helper function to display badges
  const renderBadges = (badges?: string[]) => {
    if (!badges || badges.length === 0) return null;
    
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {badges.map(badgeId => {
          const badge = badgeDisplayMap[badgeId];
          if (!badge) return null;
          
          return badge.isSpecial ? (
            <GlowingBadge
              key={badgeId}
              icon={badge.icon}
              label={badge.label}
              color={badge.color}
              glowColor={badge.glowColor || "rgba(255, 255, 255, 0.5)"}
              size="sm"
            />
          ) : (
            <span key={badgeId} className={`px-2 py-0.5 text-xs font-semibold rounded-full ${badge.color}`}>
              {badge.icon}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-white text-gray-900">
      <div className="w-full max-w-5xl mx-auto py-8 sm:py-12">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-red-600">
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
            <p className="text-xl text-gray-600">Summoning the Leaderboard...</p>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 mx-auto mt-4"></div>
          </div>
        )}
        {error && <p className="text-center text-red-700 bg-red-100 p-4 rounded-lg border border-red-300">Error: {error}</p>}
        
        {!isLoading && !error && leaderboard.length === 0 && (
          <div className="text-center py-10 bg-gray-100 p-6 rounded-lg shadow-lg border border-gray-200">
            <p className="text-2xl text-gray-700 mb-3">The Leaderboard Awaits Its Heroes!</p>
            <p className="text-gray-600">Be the first to etch your name and claim the top spot.</p>
          </div>
        )}

        {!isLoading && !error && leaderboard.length > 0 && (
          <div className="overflow-x-auto shadow-xl rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-4 sm:px-6 font-semibold text-gray-600 tracking-wider uppercase text-sm">Rank</th>
                  <th className="text-left py-4 px-4 sm:px-6 font-semibold text-gray-600 tracking-wider uppercase text-sm">Contender</th>
                  <th className="text-left py-4 px-4 sm:px-6 font-semibold text-gray-600 tracking-wider uppercase text-sm">Tier & Badges</th>
                  <th className="text-right py-4 px-4 sm:px-6 font-semibold text-gray-600 tracking-wider uppercase text-sm">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {leaderboard.map((entry, index) => {
                  const rank = index + 1;
                  const isCurrentUser = entry.walletAddress === currentUserWalletAddress;
                  
                  let rankDisplay: React.ReactNode = rank;
                  let rowClasses = "transition-all duration-150 ease-in-out";

                  if (rank === 1) {
                    rankDisplay = <span className="text-yellow-600 text-xl font-semibold">🏆 {rank}</span>;
                    rowClasses += " bg-yellow-50 hover:bg-yellow-100";
                  } else if (rank === 2) {
                    rankDisplay = <span className="text-slate-500 text-lg font-semibold">🥈 {rank}</span>;
                    rowClasses += " bg-slate-50 hover:bg-slate-100";
                  } else if (rank === 3) {
                    rankDisplay = <span className="text-orange-500 font-semibold">🥉 {rank}</span>;
                    rowClasses += " bg-orange-50 hover:bg-orange-100";
                  } else {
                    rowClasses += " hover:bg-gray-50";
                  }

                  if (isCurrentUser) {
                    rowClasses += " ring-2 ring-purple-500 scale-105 z-10 bg-purple-100 shadow-md";
                  }

                  const hasGenerousDonorBadge = entry.earnedBadgeIds?.includes('generous_donor_badge');
                  if (hasGenerousDonorBadge && !isCurrentUser) {
                    rowClasses += " bg-violet-100 hover:bg-violet-200";
                  } else if (hasGenerousDonorBadge && isCurrentUser) {
                    rowClasses += " bg-purple-200";
                  }

                  const tierLabel = entry.highestAirdropTierLabel || '-';
                  const tierStyleKey = entry.highestAirdropTierLabel ? entry.highestAirdropTierLabel.toLowerCase() : 'default';
                  const tierStyle = tierStyles[tierStyleKey] || tierStyles.default;

                  return (
                    <tr key={entry.walletAddress + index + rank} className={rowClasses}>
                      <td className="py-4 px-4 sm:px-6 font-medium text-gray-700 align-middle">{rankDisplay}</td>
                      <td className="py-4 px-4 sm:px-6 align-middle">
                        <div className="flex items-center gap-3">
                          <UserAvatar 
                            profileImageUrl={entry.xProfileImageUrl} 
                            username={entry.xUsername}
                            size="sm"
                          />
                          <div>
                            {entry.xUsername ? (
                              <Link href={`/profile/${entry.walletAddress}`} passHref>
                                <span className="text-gray-800 hover:text-blue-600 cursor-pointer hover:underline font-medium">@{entry.xUsername}</span>
                              </Link>
                            ) : (
                              <Link href={`/profile/${entry.walletAddress}`} passHref>
                                <span className="font-mono text-sm text-gray-600 hover:text-blue-600 cursor-pointer hover:underline">{entry.walletAddress}</span>
                              </Link>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 sm:px-6 align-middle">
                        <div>
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${tierStyle}`}>
                            {tierLabel}
                          </span>
                          {entry.earnedBadgeIds && renderBadges(entry.earnedBadgeIds)}
                        </div>
                      </td>
                      <td className="text-right py-4 px-4 sm:px-6 font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 align-middle">
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