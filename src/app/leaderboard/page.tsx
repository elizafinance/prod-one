"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import GlowingBadge from '@/components/GlowingBadge';
import UserAvatar from '@/components/UserAvatar';
import { AIR } from '@/config/points.config';
import { formatPoints } from '@/lib/utils';
import { useInfiniteQuery, InfiniteData, QueryFunctionContext } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { GlobeAltIcon, UserGroupIcon, UsersIcon } from '@heroicons/react/24/outline';

const PAGE_LIMIT = 25;

type LeaderboardType = 'global' | 'friends' | 'squad';

interface LeaderboardEntry {
  walletAddress: string;
  points: number;
  highestAirdropTierLabel?: string;
  xUsername?: string;
  xProfileImageUrl?: string;
  earnedBadgeIds?: string[];
  rank?: number;
}

interface LeaderboardApiResponse {
  leaderboard: LeaderboardEntry[];
  currentPage: number;
  totalPages: number;
  totalEntries: number;
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

const fetchLeaderboardPage = async (
  context: QueryFunctionContext<[string, LeaderboardType], number | undefined>
): Promise<LeaderboardApiResponse> => {
  const { queryKey, pageParam = 1 } = context;
  const [_key, type] = queryKey;
  const response = await fetch(`/api/users/leaderboard?type=${type}&page=${pageParam}&limit=${PAGE_LIMIT}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to fetch ${type} leaderboard data.`);
  }
  const result: LeaderboardApiResponse = await response.json();
  return result;
};

export default function LeaderboardPage() {
  const { publicKey } = useWallet();
  const currentUserWalletAddress = publicKey?.toBase58();
  const { ref: loadMoreRef, inView: isLoadMoreVisible } = useInView();
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('global');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isLoading,
    isFetchingNextPage,
    error,
    refetch,
  } = useInfiniteQuery<
    LeaderboardApiResponse,
    Error,
    InfiniteData<LeaderboardApiResponse, number | undefined>,
    [string, LeaderboardType],
    number | undefined
  >(
    {
      queryKey: ['leaderboard', leaderboardType],
      queryFn: fetchLeaderboardPage,
      getNextPageParam: (lastPage: LeaderboardApiResponse) => {
        if (lastPage.currentPage < lastPage.totalPages) {
          return lastPage.currentPage + 1;
        }
        return undefined;
      },
      initialPageParam: 1,
      staleTime: 1000 * 60 * 1,
      gcTime: 1000 * 60 * 5,
      enabled: leaderboardType === 'global',
    }
  );

  useEffect(() => {
    if (leaderboardType !== 'global') {
      return;
    }
    if (isLoadMoreVisible && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isLoadMoreVisible, hasNextPage, isFetchingNextPage, fetchNextPage, leaderboardType]);

  useEffect(() => {
    if (leaderboardType === 'global') {
        refetch();
    } else {
    }
  }, [leaderboardType, refetch]);

  const allEntries: LeaderboardEntry[] = data?.pages.flatMap((pageData: LeaderboardApiResponse) => pageData.leaderboard) ?? [];

  const leaderboardOptions: { label: string; value: LeaderboardType; icon: React.ElementType }[] = [
    { label: "Global", value: "global", icon: GlobeAltIcon },
    { label: "Friends", value: "friends", icon: UsersIcon },
    { label: "My Squad", value: "squad", icon: UserGroupIcon },
  ];

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

  const SkeletonRow = () => (
    <tr className="opacity-50 animate-pulse">
      <td className="py-4 px-4 sm:px-6"><Skeleton className="h-5 w-10 rounded" /></td>
      <td className="py-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-5 w-32 rounded" />
        </div>
      </td>
      <td className="py-4 px-4 sm:px-6"><Skeleton className="h-5 w-24 rounded" /></td>
      <td className="text-right py-4 px-4 sm:px-6"><Skeleton className="h-5 w-20 ml-auto rounded" /></td>
    </tr>
  );

  return (
    <main className="flex flex-col items-center min-h-screen bg-background text-foreground">
      <div className="w-full max-w-5xl mx-auto py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl sm:text-5xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-red-600">
            Leaderboard
          </h1>
          <Link href="/" passHref>
            <button 
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out whitespace-nowrap"
            >
              Back to Dashboard
            </button>
          </Link>
        </div>

        <div className="sticky top-0 z-30 py-3 bg-background/80 backdrop-blur-md mb-6 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 shadow-sm">
            <SegmentedControl
                options={leaderboardOptions}
                value={leaderboardType}
                onChange={(value) => setLeaderboardType(value as LeaderboardType)}
            />
        </div>

        {leaderboardType === 'global' && (
          <>
            {isLoading && allEntries.length === 0 && (
              <div className="text-center py-10">
                <p className="text-xl text-muted-foreground">Summoning Global Rankings...</p>
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600 mx-auto mt-4"></div>
              </div>
            )}
            {error && <p className="text-center text-red-700 bg-red-100 p-4 rounded-lg border border-red-300">Error: {error.message}</p>}
            
            {!isLoading && !error && allEntries.length === 0 && (
              <div className="text-center py-10 bg-card p-6 rounded-lg shadow-lg border border-border">
                <p className="text-2xl text-foreground mb-3">The Global Leaderboard Awaits Its Heroes!</p>
                <p className="text-muted-foreground">Be the first to etch your name and claim the top spot.</p>
              </div>
            )}

            {(allEntries.length > 0 || (isLoading && allEntries.length === 0) || isFetchingNextPage) && (
              <div className="overflow-x-auto shadow-xl rounded-xl border border-border bg-card">
                <table className="min-w-full">
                  <thead className="border-b border-border bg-muted">
                    <tr>
                      <th className="text-left py-4 px-4 sm:px-6 font-semibold text-muted-foreground tracking-wider uppercase text-sm">Rank</th>
                      <th className="text-left py-4 px-4 sm:px-6 font-semibold text-muted-foreground tracking-wider uppercase text-sm">Contender</th>
                      <th className="text-left py-4 px-4 sm:px-6 font-semibold text-muted-foreground tracking-wider uppercase text-sm">Tier & Badges</th>
                      <th className="text-right py-4 px-4 sm:px-6 font-semibold text-muted-foreground tracking-wider uppercase text-sm">{AIR.LABEL}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allEntries.map((entry: LeaderboardEntry, index: number) => {
                      const rank = entry.rank || index + 1;
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
                        <tr
                          key={entry.walletAddress + index + rank}
                          className={`${rowClasses} cursor-pointer`}
                          onClick={() => window.location.href = `/profile/${entry.walletAddress}`}
                        >
                          <td className="py-4 px-4 sm:px-6 font-medium text-foreground align-middle whitespace-nowrap">{rankDisplay}</td>
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
                                    <span className="text-foreground hover:text-[#2B96F1] cursor-pointer hover:underline font-medium">@{entry.xUsername}</span>
                                  </Link>
                                ) : (
                                  <Link href={`/profile/${entry.walletAddress}`} passHref>
                                    <span className="font-mono text-sm text-muted-foreground hover:text-[#2B96F1] cursor-pointer hover:underline">{entry.walletAddress}</span>
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
                          <td className="text-right py-4 px-4 sm:px-6 font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 align-middle whitespace-nowrap">
                            {formatPoints(entry.points)}
                          </td>
                        </tr>
                      );
                    })}
                    {(isLoading && allEntries.length > 0 || isFetchingNextPage) && 
                        Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={`skeleton-${i}`} />)
                    }
                  </tbody>
                </table>
                {hasNextPage && !isFetchingNextPage && (
                  <div ref={loadMoreRef} className="py-6 text-center">
                    <span className="text-muted-foreground">Loading more...</span>
                  </div>
                )}
                {!hasNextPage && allEntries.length > 0 && (
                     <p className="text-center text-muted-foreground py-6">You&apos;ve reached the end of the leaderboard!</p>
                )}
              </div>
            )}
          </>
        )}

        {leaderboardType === 'friends' && (
          <div className="text-center py-10 bg-card p-6 rounded-lg shadow-lg border border-border">
            <p className="text-2xl text-foreground mb-3">Friends Leaderboard</p>
            <p className="text-muted-foreground">This feature is coming soon! See how you rank among your friends.</p>
          </div>
        )}

        {leaderboardType === 'squad' && (
          <div className="text-center py-10 bg-card p-6 rounded-lg shadow-lg border border-border">
            <p className="text-2xl text-foreground mb-3">My Squad Leaderboard</p>
            <p className="text-muted-foreground">This feature is coming soon! See rankings within your current squad.</p>
          </div>
        )}
      </div>
    </main>
  );
} 