"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { Trophy, Medal, Crown, Star, TrendingUp, Users, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import UserAvatar from '@/components/UserAvatar';
import { AIR } from '@/config/points.config';
import { formatPoints } from '@/lib/utils';

interface LeaderboardEntry {
  walletAddress: string;
  points: number;
  highestAirdropTierLabel?: string;
  xUsername?: string;
  xProfileImageUrl?: string;
  earnedBadgeIds?: string[];
  rank?: number;
}

// Tier colors for badges
const tierColors: { [key: string]: string } = {
  bronze: "bg-orange-500",
  silver: "bg-slate-400",
  gold: "bg-yellow-500",
  diamond: "bg-sky-500",
  master: "bg-indigo-500",
  grandmaster: "bg-purple-600",
  legend: "bg-pink-600"
};

// Badge definitions
const badgeInfo: { [key: string]: { icon: React.ReactNode; label: string; description: string } } = {
  pioneer_badge: { 
    icon: <Star className="h-4 w-4" />, 
    label: "Pioneer", 
    description: "Early adopter" 
  },
  legend_tier_badge: { 
    icon: <Crown className="h-4 w-4" />, 
    label: "Legend", 
    description: "Achieved Legend tier" 
  },
  generous_donor_badge: { 
    icon: <Medal className="h-4 w-4" />, 
    label: "Generous Donor", 
    description: "Top contributor" 
  },
};

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("all");
  const { publicKey } = useWallet();
  const currentUserWalletAddress = publicKey?.toBase58();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/users/leaderboard?limit=all');
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard data');
        }
        const data = await response.json();
        // Add rank to each entry
        const leaderboardWithRanks = (data.leaderboard || []).map((entry: LeaderboardEntry, index: number) => ({
          ...entry,
          rank: index + 1
        }));
        setLeaderboard(leaderboardWithRanks);
      } catch (err) {
        setError((err as Error).message || 'Could not load leaderboard data.');
        console.error(err);
      }
      setIsLoading(false);
    };

    fetchLeaderboard();
  }, []);

  // Get current user's rank
  const currentUserRank = leaderboard.findIndex(entry => entry.walletAddress === currentUserWalletAddress) + 1;

  // Filter leaderboard based on tab
  const filteredLeaderboard = selectedTab === "all" 
    ? leaderboard 
    : leaderboard.slice(0, selectedTab === "top10" ? 10 : 50);

  const renderLeaderboardEntry = (entry: LeaderboardEntry, index: number) => {
    const isCurrentUser = entry.walletAddress === currentUserWalletAddress;
    const displayRank = entry.rank || index + 1;

    return (
      <div
        key={entry.walletAddress}
        className={`flex items-center justify-between p-4 rounded-lg border transition-all hover:shadow-md ${
          isCurrentUser ? 'bg-[#3366FF]/10 border-[#3366FF]' : 'bg-card hover:bg-accent/5'
        }`}
      >
        <div className="flex items-center gap-4">
          {/* Rank Badge */}
          <div className={`flex items-center justify-center min-w-[3rem] ${
            displayRank <= 3 ? 'scale-110' : ''
          }`}>
            {displayRank === 1 && <Trophy className="h-8 w-8 text-yellow-500" />}
            {displayRank === 2 && <Medal className="h-7 w-7 text-slate-400" />}
            {displayRank === 3 && <Medal className="h-6 w-6 text-orange-500" />}
            {displayRank > 3 && (
              <span className="text-2xl font-bold text-muted-foreground">#{displayRank}</span>
            )}
          </div>

          {/* User Info */}
          <div className="flex items-center gap-3">
            <UserAvatar 
              profileImageUrl={entry.xProfileImageUrl} 
              username={entry.xUsername || entry.walletAddress}
              size="md"
            />
            <div>
              <Link 
                href={`/profile/${entry.walletAddress}`}
                className="font-semibold hover:text-[#3366FF] transition-colors flex items-center gap-1"
              >
                {entry.xUsername ? `@${entry.xUsername}` : `${entry.walletAddress.slice(0, 6)}...${entry.walletAddress.slice(-4)}`}
                {isCurrentUser && <Badge variant="secondary" className="ml-2">You</Badge>}
              </Link>
              {/* Badges */}
              <div className="flex flex-wrap gap-1 mt-1">
                {entry.highestAirdropTierLabel && (
                  <Badge 
                    variant="secondary" 
                    className={`${tierColors[entry.highestAirdropTierLabel.toLowerCase()] || 'bg-gray-500'} text-white`}
                  >
                    {entry.highestAirdropTierLabel}
                  </Badge>
                )}
                {entry.earnedBadgeIds?.map(badgeId => {
                  const badge = badgeInfo[badgeId];
                  if (!badge) return null;
                  return (
                    <Badge key={badgeId} variant="outline" className="gap-1">
                      {badge.icon}
                      <span className="hidden sm:inline">{badge.label}</span>
                    </Badge>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Points */}
        <div className="text-right">
          <div className="text-2xl font-bold">{formatPoints(entry.points)}</div>
          <div className="text-sm text-muted-foreground">{AIR.LABEL}</div>
        </div>
      </div>
    );
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
                <BreadcrumbLink href="#">Platform</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Leaderboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <main className="flex-1 py-6">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6">
            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Players</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{leaderboard.length.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Active participants
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Your Rank</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {currentUserRank > 0 ? `#${currentUserRank}` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {currentUserRank > 0 ? `Top ${Math.round((currentUserRank / leaderboard.length) * 100)}%` : 'Not ranked'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Points</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatPoints(leaderboard.reduce((sum, entry) => sum + entry.points, 0))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Community total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Points</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {leaderboard.length > 0 
                      ? formatPoints(Math.round(leaderboard.reduce((sum, entry) => sum + entry.points, 0) / leaderboard.length))
                      : '0'
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Per player
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Leaderboard Table */}
            <Card>
              <CardHeader>
                <CardTitle>Global Rankings</CardTitle>
                <CardDescription>
                  Top performers in the DeFAI ecosystem
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="top10" value={selectedTab} onValueChange={setSelectedTab}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="top10">Top 10</TabsTrigger>
                    <TabsTrigger value="top50">Top 50</TabsTrigger>
                    <TabsTrigger value="all">All Players</TabsTrigger>
                  </TabsList>

                  <TabsContent value={selectedTab} className="space-y-2">
                    {isLoading ? (
                      <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3366FF]"></div>
                        <p className="mt-2 text-muted-foreground">Loading rankings...</p>
                      </div>
                    ) : error ? (
                      <div className="text-center py-8">
                        <p className="text-destructive">{error}</p>
                        <Button 
                          onClick={() => window.location.reload()} 
                          variant="outline" 
                          className="mt-4"
                        >
                          Try Again
                        </Button>
                      </div>
                    ) : filteredLeaderboard.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No players found</p>
                      </div>
                    ) : (
                      <>
                        <div className="space-y-2">
                          {filteredLeaderboard.map((entry, index) => renderLeaderboardEntry(entry, index))}
                        </div>
                        
                        {/* Show current user if not in filtered list */}
                        {currentUserRank > 0 && 
                         currentUserRank > filteredLeaderboard.length && 
                         selectedTab !== "all" && (
                          <div className="mt-8 pt-8 border-t">
                            <p className="text-sm text-muted-foreground mb-4 text-center">Your Position</p>
                            {renderLeaderboardEntry(
                              leaderboard.find(e => e.walletAddress === currentUserWalletAddress)!, 
                              currentUserRank - 1
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
}