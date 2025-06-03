'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Clock, Target, Gift, ArrowLeft, Users, TrendingUp, Star, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

// Shared types (ideally from a common types file)
interface QuestDisplayData {
  _id: string;
  title: string;
  description_md: string;
  goal_type: string;
  goal_target_metadata?: { tier_name?: string; currency?: string };
  reward_type: string;
  reward_points?: number;
  reward_nft_id?: string;
  start_ts: string;
  end_ts: string;
  status: string;
  progress: number;
  goal: number;
}

interface QuestProgressUpdateEvent {
  questId: string;
  currentProgress: number;
  goalTarget: number;
}


// Re-use or adapt calculateRemainingTime from quests/page.tsx
function calculateRemainingTime(endDateString: string): string {
  const now = new Date();
  const endDate = new Date(endDateString);
  const diff = endDate.getTime() - now.getTime();
  if (diff <= 0) {
    if (new Date(endDateString) < new Date('1971-01-01T00:00:00.000Z')) return 'Date not set'; // Handle invalid/uninitialized dates
    return 'Ended';
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return 'Ending soon';
}

const WEBSOCKET_SERVER_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001';

export default function QuestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const questId = params?.questId as string;

  const [quest, setQuest] = useState<QuestDisplayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQuestDetails = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/quests/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 404) throw new Error('Quest not found.');
        throw new Error(errorData.error || `Failed to fetch quest details: ${response.status}`);
      }
      const data: QuestDisplayData = await response.json();
      setQuest(data);
    } catch (err: any) {
      console.error("Error fetching quest details:", err);
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (questId) {
      fetchQuestDetails(questId);
    }
  }, [questId, fetchQuestDetails]);

  useEffect(() => {
    if (!questId || typeof window === 'undefined') return;

    const socket: Socket = io(WEBSOCKET_SERVER_URL);

    socket.on('connect', () => console.log('[QuestDetail/WS] Connected:', socket.id));
    socket.on('disconnect', (reason) => console.log('[QuestDetail/WS] Disconnected:', reason));
    socket.on('connect_error', (err) => console.error('[QuestDetail/WS] Connection error:', err));

    socket.on('quest_progress_update', (update: QuestProgressUpdateEvent) => {
      if (update.questId === questId) {
        console.log('[QuestDetail/WS] Received relevant progress update:', update);
        setQuest(prevQuest => 
          prevQuest ? { ...prevQuest, progress: update.currentProgress, goal: update.goalTarget } : null
        );
      }
    });

    return () => {
      console.log('[QuestDetail/WS] Disconnecting WebSocket...');
      socket.disconnect();
    };
  }, [questId]);

  const getGoalUnit = () => {
    if (!quest) return 'Units';
    if (quest.goal_type === 'users_at_tier') return 'Users';
    if (quest.goal_type === 'total_referrals') return 'Referrals';
    if (quest.goal_type === 'aggregate_spend') {
        return quest.goal_target_metadata?.currency || 'Value';
    }
    return 'Units';
  }

  const renderRewardInfo = () => {
    if (!quest) return null;
    const parts: string[] = [];
    if (quest.reward_points && (quest.reward_type === 'points' || quest.reward_type === 'points+nft')) {
      parts.push(`${quest.reward_points.toLocaleString()} Points`);
    }
    if (quest.reward_nft_id && (quest.reward_type === 'nft' || quest.reward_type === 'points+nft')) {
      parts.push(`Special NFT (${quest.reward_nft_id})`); // Consider linking to NFT details or showing image
    }
    if (parts.length === 0) return <p className="text-muted-foreground">Details about rewards will be shown here.</p>;
    return <p className="text-lg text-green-400">Reward: {parts.join(' + ')}</p>;
  };

  if (isLoading) {
    return (
      <SidebarInset>
        <div className="flex items-center justify-center min-h-screen">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3366FF]"></div>
          <p className='ml-3'>Loading quest details...</p>
        </div>
      </SidebarInset>
    );
  }

  if (error) {
    return (
      <SidebarInset>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="text-lg text-destructive mb-4">Error: {error}</p>
          <Button asChild>
            <Link href="/quests">Back to all quests</Link>
          </Button>
        </div>
      </SidebarInset>
    );
  }

  if (!quest) {
    return (
      <SidebarInset>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="text-xl mb-4">Quest not found.</p>
          <Button asChild>
            <Link href="/quests">Back to all quests</Link>
          </Button>
        </div>
      </SidebarInset>
    );
  }

  const renderCallToActionButton = () => {
    if (quest.status !== 'active') return null;

    let ctaText = 'Participate';
    let ctaLink = '#'; // Default or placeholder link
    let ctaOnClick: (() => void) | undefined = undefined;

    switch (quest.goal_type) {
      case 'total_referrals':
        ctaText = 'Invite Friends Now!';
        ctaLink = '/referrals'; // Example link to a referrals page
        break;
      case 'users_at_tier':
        ctaText = `Reach ${quest.goal_target_metadata?.tier_name || 'Target'} Tier`;
        // ctaLink = '/my-profile/tier'; // Example link to a tier progress page
        // Or perhaps open a modal with info on how to upgrade tier
        ctaOnClick = () => alert('Information on how to reach this tier would be shown here, or link to profile/tier page.');
        break;
      case 'aggregate_spend':
        ctaText = 'Make a Purchase';
        // ctaLink = '/store'; // Example link to a store or marketplace
        ctaOnClick = () => alert('Link to store/marketplace where users can spend would be here.');
        break;
      default:
        return null; // No specific CTA for unknown or other types yet
    }

    if (ctaOnClick) {
        return (
          <Button onClick={ctaOnClick} className="bg-[#3366FF] hover:bg-[#2952cc]">
            <ExternalLink className="h-4 w-4 mr-2" />
            {ctaText}
          </Button>
        );
    }
    return (
      <Button asChild className="bg-[#3366FF] hover:bg-[#2952cc]">
        <Link href={ctaLink}>
          <ExternalLink className="h-4 w-4 mr-2" />
          {ctaText}
        </Link>
      </Button>
    );
  };

  const progressPercentage = quest.goal > 0 ? Math.min((quest.progress / quest.goal) * 100, 100) : 0;
  const timeRemaining = calculateRemainingTime(quest.end_ts);
  const isExpired = timeRemaining === 'Ended';

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Platform</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink href="/quests">Quests</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{quest.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto flex items-center gap-4 px-4">
          <Button variant="outline" asChild>
            <Link href="/quests">
              <ArrowLeft className="h-4 w-4 mr-2" />
              All Quests
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 py-6">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 max-w-4xl mx-auto">
            {/* Quest Header */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-3xl">{quest.title}</CardTitle>
                    <CardDescription className="mt-2">
                      Complete this quest to earn rewards and contribute to the community
                    </CardDescription>
                  </div>
                  <Badge variant={
                    quest.status === 'active' ? 'default' :
                    quest.status === 'succeeded' ? 'secondary' : 'outline'
                  }>
                    {quest.status.charAt(0).toUpperCase() + quest.status.slice(1)}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Quest Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Progress</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {quest.progress.toLocaleString()} / {quest.goal.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getGoalUnit()} • {Math.round(progressPercentage)}% complete
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Time Remaining</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${isExpired ? 'text-destructive' : ''}`}>
                    {timeRemaining}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {isExpired ? 'Quest has ended' : 'Time left to complete'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Reward</CardTitle>
                  <Gift className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {quest.reward_points?.toLocaleString() || 'TBD'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {quest.reward_points ? 'Points' : 'Special reward'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Progress Bar */}
            <Card>
              <CardHeader>
                <CardTitle>Quest Progress</CardTitle>
                <CardDescription>Track the community&apos;s progress toward the goal</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Current Progress</span>
                    <span>{quest.progress.toLocaleString()} {getGoalUnit()}</span>
                  </div>
                  <Progress value={progressPercentage} className="h-3" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0</span>
                    <span>{quest.goal.toLocaleString()} {getGoalUnit()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quest Description */}
            <Card>
              <CardHeader>
                <CardTitle>Description & Rules</CardTitle>
                <CardDescription>Learn how to participate and what&apos;s required</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{quest.description_md}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>

            {/* Rewards */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="h-5 w-5" />
                  Quest Rewards
                </CardTitle>
                <CardDescription>What you&apos;ll earn for completing this quest</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {quest.reward_points && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <Star className="h-8 w-8 text-[#3366FF]" />
                      <div>
                        <p className="font-semibold">{quest.reward_points.toLocaleString()} Points</p>
                        <p className="text-sm text-muted-foreground">DeFAI reward points</p>
                      </div>
                    </div>
                  )}
                  {quest.reward_nft_id && (
                    <div className="flex items-center gap-3 p-3 border rounded-lg">
                      <TrendingUp className="h-8 w-8 text-[#3366FF]" />
                      <div>
                        <p className="font-semibold">Special NFT</p>
                        <p className="text-sm text-muted-foreground">NFT ID: {quest.reward_nft_id}</p>
                      </div>
                    </div>
                  )}
                  {!quest.reward_points && !quest.reward_nft_id && (
                    <p className="text-muted-foreground">Reward details will be announced soon.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Call to Action */}
            {quest.status === 'active' && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    {renderCallToActionButton()}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </SidebarInset>
  );
} 