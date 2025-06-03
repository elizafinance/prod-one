'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Star, Trophy, Clock, Target, Gift, Filter, Search } from "lucide-react";
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

// Interface for individual quest data from /api/quests/all
interface Quest {
  _id: string;
  title: string;
  description?: string;         // Full description, possibly markdown
  status?: 'scheduled' | 'active' | 'completed' | 'expired' | string; // Allow more statuses
  goal_target?: number;
  progress?: number;            // Overall progress if available from API
  goal_units?: string;          // e.g., "Units", "Points", "Referrals"
  reward_description?: string;  // Text description of the reward
  reward_points?: number;       // Specific points if applicable
  start_ts?: string;
  end_ts?: string;
  // Add other relevant fields returned by your API
  // For example, if your API returns a pre-formatted rules string:
  // rules?: string;
}

// Helper to calculate remaining time
function calculateRemainingTime(endDateString?: string): string {
  if (!endDateString) return 'N/A';
  const now = new Date();
  const endDate = new Date(endDateString);
  const diff = endDate.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Ended';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  if (days > 7) return `> 7 days left`;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return 'Ending soon';
}

const QuestsPage = () => {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuests = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/quests/all'); 
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch quests: ${response.statusText}`);
        }
        const data: Quest[] = await response.json();
        setQuests(data);
      } catch (err: any) {
        console.error("Error fetching quests:", err);
        setError(err.message || "Could not load quests.");
        setQuests([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuests();
  }, []);

  if (isLoading) {
    return (
      <SidebarInset>
        <div className="flex items-center justify-center min-h-screen">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3366FF]"></div>
          <p className='ml-3'>Loading quests...</p>
        </div>
      </SidebarInset>
    );
  }

  if (error) {
    return (
      <SidebarInset>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="text-lg text-destructive mb-4">Error: {error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </SidebarInset>
    );
  }

  const activeQuests = quests.filter(q => q.status === 'active');
  const completedQuests = quests.filter(q => q.status === 'completed');
  const totalRewards = quests.reduce((sum, q) => sum + (q.reward_points || 0), 0);

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
                <BreadcrumbPage>Quests</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <main className="flex-1 py-6">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6">
            {/* Page Header */}
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl">Community Quests</CardTitle>
                <CardDescription>
                  Participate in community-wide challenges and earn rewards!
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Quests</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{quests.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Available challenges
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Quests</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeQuests.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Currently available
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completedQuests.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Finished quests
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Rewards</CardTitle>
                  <Gift className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalRewards.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Points available
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Quests Grid */}
            <Card>
              <CardHeader>
                <CardTitle>Available Quests</CardTitle>
                <CardDescription>Complete these challenges to earn rewards and recognition</CardDescription>
              </CardHeader>
              <CardContent>
                {quests.length === 0 ? (
                  <div className="text-center py-12">
                    <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No quests available at the moment. Check back soon!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quests.map((quest) => {
                      const progressPercentage = quest.goal_target && quest.goal_target > 0 && quest.progress !== undefined
                        ? (quest.progress / quest.goal_target) * 100
                        : 0;
                      const timeRemaining = calculateRemainingTime(quest.end_ts);
                      const isExpired = timeRemaining === 'Ended';

                      return (
                        <Card key={quest._id} className="flex flex-col h-full">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <CardTitle className="text-lg">{quest.title}</CardTitle>
                              {quest.status && (
                                <Badge variant={
                                  quest.status === 'active' ? 'default' :
                                  quest.status === 'scheduled' ? 'secondary' : 'outline'
                                }>
                                  {quest.status.charAt(0).toUpperCase() + quest.status.slice(1)}
                                </Badge>
                              )}
                            </div>
                            <CardDescription className="line-clamp-3">
                              {quest.description || 'No description provided.'}
                            </CardDescription>
                          </CardHeader>
                          
                          <CardContent className="flex-grow space-y-4">
                            {/* Progress */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span>Progress</span>
                                <span>{quest.progress?.toLocaleString() || 0} / {quest.goal_target?.toLocaleString() || 'N/A'} {quest.goal_units || ''}</span>
                              </div>
                              <Progress value={progressPercentage} className="h-2" />
                            </div>

                            {/* Time Remaining */}
                            {quest.end_ts && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span className={isExpired ? 'text-destructive' : ''}>
                                  {timeRemaining}
                                </span>
                              </div>
                            )}

                            {/* Rewards */}
                            {(quest.reward_points || quest.reward_description) && (
                              <div className="space-y-2 pt-3 border-t">
                                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                  <Gift className="h-4 w-4" />
                                  REWARD
                                </div>
                                {quest.reward_points && (
                                  <p className="text-sm font-semibold text-[#3366FF]">
                                    {quest.reward_points.toLocaleString()} Points
                                  </p>
                                )}
                                {quest.reward_description && (
                                  <p className="text-xs text-muted-foreground">
                                    {quest.reward_description}
                                  </p>
                                )}
                              </div>
                            )}
                          </CardContent>
                          
                          <div className="p-6 pt-0">
                            <Button 
                              asChild 
                              variant={isExpired ? "secondary" : "default"} 
                              className="w-full"
                              disabled={isExpired && quest.status !== 'completed'}
                            >
                              <Link href={`/quests/${quest._id}`}>
                                {isExpired && quest.status !== 'completed' ? 'Quest Ended' : 'View Quest Details'}
                              </Link>
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
};

export default QuestsPage; 