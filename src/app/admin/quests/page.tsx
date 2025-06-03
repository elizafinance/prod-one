'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Star, Target, Gift, Clock, Filter, Edit, Trash2 } from "lucide-react";
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
import { TOKEN_LABEL_POINTS } from '@/lib/labels';

// Define the structure of the quest data from the admin API
// This should align with the CommunityQuest model + any lean() modifications
interface AdminQuestData {
  _id: string;
  title: string;
  description_md: string;
  goal_type: string;
  goal_target: number;
  goal_target_metadata?: any;
  reward_type: string;
  reward_points?: number;
  reward_nft_id?: string;
  rewards?: any[];
  start_ts: string; // ISO date string
  end_ts: string;   // ISO date string
  status: string;
  created_by?: string;
  created_ts?: string; // ISO date string
  updated_ts?: string; // ISO date string
  notes?: string;
  scope: 'community' | 'squad'; // Added scope property
}

interface AdminQuestsApiResponse {
    quests: AdminQuestData[];
    currentPage: number;
    totalPages: number;
    totalQuests: number;
}

const QUEST_STATUSES = ['scheduled', 'active', 'succeeded', 'failed', 'expired'];
const GOAL_TYPES = ['total_referrals', 'users_at_tier', 'aggregate_spend'];
const SORTABLE_FIELDS = [
    { label: 'Creation Date', value: 'created_ts' },
    { label: 'Start Date', value: 'start_ts' },
    { label: 'End Date', value: 'end_ts' },
    { label: 'Title', value: 'title' },
    { label: 'Status', value: 'status' },
];
const ITEMS_PER_PAGE = 15;

interface FilterState {
  status: string;
  goal_type: string;
  scope: string; // Added scope to filter state
}

export default function AdminQuestsPage() {
  const [quests, setQuests] = useState<AdminQuestData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const router = useRouter(); // Not used for now

  // Filters and Sort State
  const [filters, setFilters] = useState<FilterState>({ status: '', goal_type: '', scope: '' });
  const [sortParams, setSortParams] = useState({ sortBy: 'created_ts', order: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchQuests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.goal_type) params.append('goal_type', filters.goal_type);
    if (filters.scope) params.append('scope', filters.scope);
    params.append('sortBy', sortParams.sortBy);
    params.append('order', sortParams.order);
    params.append('page', currentPage.toString());
    params.append('limit', ITEMS_PER_PAGE.toString());

    try {
      const response = await fetch(`/api/admin/quests?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch quests: ${response.status}`);
      }
      const data: AdminQuestsApiResponse = await response.json();
      // Ensure reward_type is present for table display
      const enriched = data.quests.map((q) => {
        if (q.reward_type) return q;
        // derive from rewards array if available
        // @ts-ignore
        const rewardsArr = q.rewards as any[] | undefined;
        if (!rewardsArr) return q;
        const hasPoints = rewardsArr.some((r) => r.type === 'points');
        const hasNFT = rewardsArr.some((r) => r.type === 'nft');
        let reward_type: string | undefined;
        if (hasPoints && hasNFT) reward_type = 'points+nft';
        else if (hasPoints) reward_type = 'points';
        else if (hasNFT) reward_type = 'nft';
        return { ...q, reward_type } as AdminQuestData;
      });
      setQuests(enriched);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      console.error("Error fetching admin quests:", err);
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, sortParams, currentPage]);

  useEffect(() => {
    fetchQuests();
  }, [fetchQuests]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortParams(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setCurrentPage(1); // Reset to first page on sort change
  };
  
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
        setCurrentPage(newPage);
    }
  };

  const handleArchiveQuest = async (questId: string, questTitle: string) => {
    if (!window.confirm(`Are you sure you want to archive quest: "${questTitle}"?`)) return;
    try {
      const response = await fetch(`/api/admin/quests/${questId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await response.text());
      alert('Quest archived successfully!');
      fetchQuests(); 
    } catch (err: any) { alert(`Error: ${err.message}`); }
  };

  // TODO: Implement proper admin role check on the frontend if needed,
  // although API is the main security gate.

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
  const completedQuests = quests.filter(q => q.status === 'succeeded');
  const communityQuests = quests.filter(q => q.scope === 'community');
  const squadQuests = quests.filter(q => q.scope === 'squad');

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
                <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Quests</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto flex items-center gap-4 px-4">
          <Button asChild className="bg-[#3366FF] hover:bg-[#2952cc]">
            <Link href="/admin/quests/new">
              <Plus className="h-4 w-4 mr-2" />
              Create New Quest
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 py-6">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6">
            {/* Page Header */}
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl flex items-center gap-3">
                  <Star className="h-8 w-8" />
                  Quest Management
                </CardTitle>
                <CardDescription>
                  Create and manage community and squad quests
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
                    All quest types
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
                    Currently running
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Community</CardTitle>
                  <Gift className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{communityQuests.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Community scope
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Squad Quests</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{squadQuests.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Squad scope
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Filters and Sorting UI */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters & Sorting
                </CardTitle>
                <CardDescription>Filter and sort quests by various criteria</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label htmlFor="status-filter" className="block text-sm font-medium mb-1">Filter by Status:</label>
                    <select id="status-filter" name="status" value={filters.status} onChange={handleFilterChange} className="w-full p-2 border rounded-md">
                      <option value="">All Statuses</option>
                      {QUEST_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="goal_type-filter" className="block text-sm font-medium mb-1">Filter by Goal Type:</label>
                    <select id="goal_type-filter" name="goal_type" value={filters.goal_type} onChange={handleFilterChange} className="w-full p-2 border rounded-md">
                      <option value="">All Goal Types</option>
                      {GOAL_TYPES.map(gt => <option key={gt} value={gt}>{gt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="scope-filter" className="block text-sm font-medium mb-1">Filter by Scope:</label>
                    <select id="scope-filter" name="scope" value={filters.scope} onChange={handleFilterChange} className="w-full p-2 border rounded-md">
                      <option value="">All Scopes</option>
                      <option value="community">Community</option>
                      <option value="squad">Squad</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="sort" className="block text-sm font-medium mb-1">Sort by:</label>
                    <select id="sort" name="sort" value={sortParams.sortBy} onChange={handleSortChange} className="w-full p-2 border rounded-md">
                      <option value="start_ts">Start Date</option>
                      <option value="end_ts">End Date</option>
                      <option value="title">Title</option>
                      <option value="status">Status</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="order" className="block text-sm font-medium mb-1">Order:</label>
                    <select id="order" name="order" value={sortParams.order} onChange={handleSortChange} className="w-full p-2 border rounded-md">
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quests Grid */}
            <Card>
              <CardHeader>
                <CardTitle>Quest List</CardTitle>
                <CardDescription>Manage all community and squad quests</CardDescription>
              </CardHeader>
              <CardContent>
                {quests.length === 0 ? (
                  <div className="text-center py-12">
                    <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No quests found matching your filters.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {quests.map(quest => (
                      <Card key={quest._id} className="hover:shadow-lg transition-shadow">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <CardTitle className="text-lg">{quest.title}</CardTitle>
                            <Badge variant={
                              quest.status === 'active' ? 'default' :
                              quest.status === 'scheduled' ? 'secondary' :
                              quest.status === 'succeeded' ? 'outline' :
                              'outline'
                            }>
                              {quest.status.charAt(0).toUpperCase() + quest.status.slice(1)}
                            </Badge>
                          </div>
                          <CardDescription className="line-clamp-2">
                            {quest.description_md}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Goal Type:</span>
                              <span className="font-medium">{quest.goal_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Target:</span>
                              <span className="font-medium">{quest.goal_target}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Reward:</span>
                              <span className="font-medium">
                                {quest.reward_type === 'points' ? `${quest.reward_points} ${TOKEN_LABEL_POINTS}` :
                                 quest.reward_type === 'nft' ? 'NFT' :
                                 `${quest.reward_points} ${TOKEN_LABEL_POINTS} + NFT`}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Scope:</span>
                              <Badge variant="outline" className="text-xs">
                                {quest.scope}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Start:</span>
                              <span className="font-medium text-xs">{new Date(quest.start_ts).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">End:</span>
                              <span className="font-medium text-xs">{new Date(quest.end_ts).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/admin/quests/edit/${quest._id}`}>
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Link>
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              onClick={() => handleArchiveQuest(quest._id, quest.title)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Archive
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
} 