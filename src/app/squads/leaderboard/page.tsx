"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
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
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Trophy, Crown, Medal, Award, Shield, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

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
  const router = useRouter();
  const currentUserWalletAddress = publicKey?.toBase58();

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
                <BreadcrumbPage>Leaderboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Squad Leaderboard</h1>
          <div className="flex gap-2">
            <Link href="/squads/browse">
              <Button variant="outline">
                Browse Squads
              </Button>
            </Link>
            <Link href="/squads/my">
              <Button variant="outline">
                <Shield className="h-4 w-4 mr-2" />
                My Squad
              </Button>
            </Link>
          </div>
        </div>

        {isLoading && (
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48 mt-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div>
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32 mt-1" />
                      </div>
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive text-center">Error: {error}</p>
            </CardContent>
          </Card>
        )}
        
        {!isLoading && !error && leaderboard.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-10">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-semibold mb-2">No Squads on the Leaderboard Yet!</p>
                <p className="text-sm text-muted-foreground mb-4">Be the first to create a squad and dominate the rankings.</p>
                <Link href="/squads/create">
                  <Button>
                    Create Squad
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && leaderboard.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Squad Rankings</CardTitle>
              <CardDescription>
                Top performing squads by total points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Squad</TableHead>
                    <TableHead className="text-center">Members</TableHead>
                    <TableHead className="text-right">Total Points</TableHead>
                    <TableHead className="text-right">Avg per Member</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaderboard.map((squad, index) => {
                    const rank = index + 1;

                    return (
                      <TableRow 
                        key={squad.squadId} 
                        className={`cursor-pointer transition-colors hover:bg-muted/50 ${rank <= 3 ? "bg-muted/30" : ""}`}
                        onClick={() => router.push(`/squads/${squad.squadId}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {rank === 1 && <Crown className="h-5 w-5 text-yellow-500" />}
                            {rank === 2 && <Medal className="h-5 w-5 text-gray-400" />}
                            {rank === 3 && <Award className="h-5 w-5 text-orange-500" />}
                            <span className={`font-bold ${
                              rank === 1 ? "text-yellow-600" :
                              rank === 2 ? "text-gray-600" :
                              rank === 3 ? "text-orange-600" :
                              "text-foreground"
                            }`}>
                              #{rank}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src="/placeholder.svg" />
                              <AvatarFallback>{squad.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {squad.name}
                              </div>
                              {squad.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-xs">
                                  {squad.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{squad.memberCount}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-bold text-lg">
                            {squad.totalSquadPoints.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="text-sm text-muted-foreground">
                            {squad.memberCount > 0 ? Math.round(squad.totalSquadPoints / squad.memberCount).toLocaleString() : '0'}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </SidebarInset>
  );
} 