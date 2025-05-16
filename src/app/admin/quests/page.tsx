'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
// import { useRouter } from 'next/navigation'; // Not used directly now

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

export default function AdminQuestsPage() {
  const [quests, setQuests] = useState<AdminQuestData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const router = useRouter(); // Not used for now

  // Filters and Sort State
  const [filters, setFilters] = useState({ status: '', goal_type: '' });
  const [sortParams, setSortParams] = useState({ sortBy: 'created_ts', order: 'desc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchQuests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.goal_type) params.append('goal_type', filters.goal_type);
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
    <div className="container mx-auto px-4 py-8 min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-foreground">Admin: Community Quests</h1>
        <Link href="/admin/quests/new" className="bg-[#2B96F1] hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md shadow-md transition-colors">
          Create New Quest
        </Link>
      </div>

      {/* Filters and Sorting UI */}
      <div className="mb-6 p-4 bg-card rounded-lg shadow-md border flex flex-wrap gap-4 items-end">
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
          <label htmlFor="sortBy-select" className="block text-sm font-medium text-foreground mb-1">Sort By:</label>
          <select id="sortBy-select" name="sortBy" value={sortParams.sortBy} onChange={handleSortChange} className="w-full bg-background border-input text-foreground rounded-md shadow-sm p-2.5 text-sm focus:ring-[#2B96F1] focus:border-[#2B96F1]">
            {SORTABLE_FIELDS.map(sf => <option key={sf.value} value={sf.value}>{sf.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="order-select" className="block text-sm font-medium text-foreground mb-1">Order:</label>
          <select id="order-select" name="order" value={sortParams.order} onChange={handleSortChange} className="w-full bg-background border-input text-foreground rounded-md shadow-sm p-2.5 text-sm focus:ring-[#2B96F1] focus:border-[#2B96F1]">
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {isLoading && <div className="p-8 text-center text-muted-foreground">Loading quests...</div>}
      {error && <div className="p-8 text-center text-destructive">Error: {error}</div>}
      {!isLoading && !error && quests.length === 0 && (
        <p className="text-muted-foreground text-center py-4">No quests found matching your criteria.</p>
      )}
      {!isLoading && !error && quests.length > 0 && (
        <div className="overflow-x-auto bg-card shadow-xl rounded-lg border">
          <table className="min-w-full table-auto text-sm text-left">
            <thead className="bg-muted text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-6 py-3">Title</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Goal Type</th>
                <th className="px-6 py-3">Goal Target</th>
                <th className="px-6 py-3">Reward Type</th>
                <th className="px-6 py-3">Start Date</th>
                <th className="px-6 py-3">End Date</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="text-foreground divide-y divide-border">
              {quests.map((quest) => (
                <tr key={quest._id} className="hover:bg-muted/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/admin/quests/edit/${quest._id}`} className="font-medium text-[#2B96F1] hover:text-blue-600 transition-colors">
                        {quest.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full 
                      ${quest.status === 'active' ? 'bg-green-600 text-green-100' : 
                        quest.status === 'scheduled' ? 'bg-yellow-600 text-yellow-100' : 
                        quest.status === 'succeeded' ? 'bg-[#2B96F1] text-white' : 
                        'bg-destructive text-destructive-foreground'}`}>
                      {quest.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{quest.goal_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{quest.goal_target.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{quest.reward_type}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(quest.start_ts).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(quest.end_ts).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap space-x-2">
                    <Link href={`/admin/quests/edit/${quest._id}`} className="text-[#2B96F1] hover:text-blue-600 font-medium transition-colors">
                      Edit
                    </Link>
                    <button 
                      onClick={() => handleArchiveQuest(quest._id, quest.title)}
                      className="text-destructive hover:text-destructive/80 font-medium transition-colors"
                    >
                      Archive
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Pagination Controls */}
      {totalPages > 1 && !isLoading && (
        <div className="mt-8 flex justify-center items-center space-x-2">
          <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground rounded-md disabled:opacity-50 transition-colors">Previous</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(pageNumber => pageNumber === 1 || pageNumber === totalPages || (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1) || (currentPage <= 3 && pageNumber <= 3) || (currentPage >= totalPages - 2 && pageNumber >= totalPages - 2))
            .map((pageNumber, index, arr) => (
            <React.Fragment key={pageNumber}>
                {index > 0 && arr[index-1] !== pageNumber -1 && <span className="text-muted-foreground px-1">...</span>}
                <button onClick={() => handlePageChange(pageNumber)} className={`px-4 py-2 rounded-md transition-colors ${currentPage === pageNumber ? 'bg-[#2B96F1] text-white' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}>{pageNumber}</button>
            </React.Fragment>
          ))}
          <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground rounded-md disabled:opacity-50 transition-colors">Next</button>
        </div>
      )}
    </div>
  );
} 