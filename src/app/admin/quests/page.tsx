'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
// import { useRouter } from 'next/navigation'; // Not used directly now
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
    return <div className="p-8 text-center text-muted-foreground">Loading quests...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-destructive">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen bg-background">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-foreground">Admin: Community Quests</h1>
        <Link href="/admin/quests/new" className="bg-[#2B96F1] hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md shadow-md transition-colors flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Create New Quest
        </Link>
      </div>

      {/* Filters and Sorting UI */}
      <div className="mb-6 p-4 bg-card rounded-lg shadow-md border border-border flex flex-wrap gap-4 items-end">
        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-foreground mb-1">Filter by Status:</label>
          <select id="status-filter" name="status" value={filters.status} onChange={handleFilterChange} className="w-full bg-background border-input text-foreground rounded-md shadow-sm p-2.5 text-sm focus:ring-[#2B96F1] focus:border-[#2B96F1]">
            <option value="">All Statuses</option>
            {QUEST_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="goal_type-filter" className="block text-sm font-medium text-foreground mb-1">Filter by Goal Type:</label>
          <select id="goal_type-filter" name="goal_type" value={filters.goal_type} onChange={handleFilterChange} className="w-full bg-background border-input text-foreground rounded-md shadow-sm p-2.5 text-sm focus:ring-[#2B96F1] focus:border-[#2B96F1]">
            <option value="">All Goal Types</option>
            {GOAL_TYPES.map(gt => <option key={gt} value={gt}>{gt.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="scope-filter" className="block text-sm font-medium text-foreground mb-1">Filter by Scope:</label>
          <select id="scope-filter" name="scope" value={filters.scope} onChange={handleFilterChange} className="w-full bg-background border-input text-foreground rounded-md shadow-sm p-2.5 text-sm focus:ring-[#2B96F1] focus:border-[#2B96F1]">
            <option value="">All Scopes</option>
            <option value="community">Community</option>
            <option value="squad">Squad</option>
          </select>
        </div>
        <div>
          <label htmlFor="sort" className="block text-sm font-medium text-foreground mb-1">Sort by:</label>
          <select id="sort" name="sort" value={sortParams.sortBy} onChange={handleSortChange} className="w-full bg-background border-input text-foreground rounded-md shadow-sm p-2.5 text-sm focus:ring-[#2B96F1] focus:border-[#2B96F1]">
            <option value="start_ts">Start Date</option>
            <option value="end_ts">End Date</option>
            <option value="title">Title</option>
            <option value="status">Status</option>
          </select>
        </div>
        <div>
          <label htmlFor="order" className="block text-sm font-medium text-foreground mb-1">Order:</label>
          <select id="order" name="order" value={sortParams.order} onChange={handleSortChange} className="w-full bg-background border-input text-foreground rounded-md shadow-sm p-2.5 text-sm focus:ring-[#2B96F1] focus:border-[#2B96F1]">
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {error && <p className="mb-4 p-3 bg-destructive/30 border border-destructive text-destructive-foreground rounded-md">Error: {error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quests.map(quest => (
          <div key={quest._id} className="bg-card rounded-lg shadow-md border border-border overflow-hidden hover:shadow-lg transition-shadow">
            <div className="p-4">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-semibold text-foreground">{quest.title}</h2>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  quest.status === 'active' ? 'bg-green-100 text-green-800' :
                  quest.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                  quest.status === 'succeeded' ? 'bg-purple-100 text-purple-800' :
                  quest.status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {quest.status.charAt(0).toUpperCase() + quest.status.slice(1)}
                </span>
              </div>
              <p className="text-muted-foreground text-sm mb-4 line-clamp-2">{quest.description_md}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Goal Type:</span>
                  <span className="text-foreground font-medium">{quest.goal_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target:</span>
                  <span className="text-foreground font-medium">{quest.goal_target}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reward:</span>
                  <span className="text-foreground font-medium">
                    {quest.reward_type === 'points' ? `${quest.reward_points} ${TOKEN_LABEL_POINTS}` :
                     quest.reward_type === 'nft' ? 'NFT' :
                     `${quest.reward_points} ${TOKEN_LABEL_POINTS} + NFT`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scope:</span>
                  <span className="text-foreground font-medium capitalize">{quest.scope}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Start:</span>
                  <span className="text-foreground font-medium">{new Date(quest.start_ts).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">End:</span>
                  <span className="text-foreground font-medium">{new Date(quest.end_ts).toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div className="bg-muted/50 px-4 py-3 flex justify-end gap-2">
              <Link href={`/admin/quests/edit/${quest._id}`} className="text-[#2B96F1] hover:text-blue-600 transition-colors flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
                Edit
              </Link>
              <button onClick={() => handleArchiveQuest(quest._id, quest.title)} className="text-destructive hover:text-red-600 transition-colors flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Archive
              </button>
            </div>
          </div>
        ))}
      </div>

      {quests.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No quests found matching your filters.</p>
        </div>
      )}
    </div>
  );
} 