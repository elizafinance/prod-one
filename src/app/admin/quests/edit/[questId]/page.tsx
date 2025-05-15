'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

// Re-use or adapt QuestFormData from new/page.tsx
interface QuestFormData {
  title: string;
  description_md: string;
  goal_type: 'total_referrals' | 'users_at_tier' | 'aggregate_spend';
  goal_target: number | string;
  goal_target_metadata?: {
    tier_name?: string;
    currency?: string;
  };
  reward_type: 'points' | 'nft' | 'points+nft';
  reward_points?: number | string;
  reward_nft_id?: string;
  start_ts: string; // Will be formatted for datetime-local
  end_ts: string;   // Will be formatted for datetime-local
  status?: 'scheduled' | 'active' | 'succeeded' | 'failed' | 'expired'; // Allow status updates
}

// Helper to format ISO date string to datetime-local string for input value
const formatDateTimeLocal = (isoString: string | undefined): string => {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    // Check if date is valid before trying to slice
    if (isNaN(date.getTime())) return ''; 
    return date.toISOString().slice(0, 16); // YYYY-MM-DDTHH:mm
  } catch (e) {
    return ''; // Handle invalid date strings gracefully
  }
};

export default function EditQuestPage() {
  const router = useRouter();
  const params = useParams();
  const questId = params?.questId as string; // Type assertion for questId

  const [formData, setFormData] = useState<Partial<QuestFormData>>({}); // Partial for initial load
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof QuestFormData | 'tier_name' | 'currency', string>>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchQuest = useCallback(async (id: string) => {
    setIsFetching(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/quests/${id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch quest: ${response.status}`);
      }
      const data = await response.json();
      setFormData({
        ...data,
        goal_target: data.goal_target?.toString() || '',
        reward_points: data.reward_points?.toString() || '',
        start_ts: formatDateTimeLocal(data.start_ts),
        end_ts: formatDateTimeLocal(data.end_ts),
        goal_target_metadata: data.goal_target_metadata || {},
      });
    } catch (err: any) {
      console.error("Error fetching quest for edit:", err);
      setError(err.message || 'An unknown error occurred while fetching quest data.');
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (questId) {
      fetchQuest(questId);
    }
  }, [questId, fetchQuest]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (fieldErrors[name as keyof QuestFormData]) {
        setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
    if (name === 'tier_name' || name === 'currency') {
        setFormData(prev => ({ ...prev, goal_target_metadata: { ...(prev.goal_target_metadata || {}), [name]: value } }));
        if (fieldErrors[name as 'tier_name' | 'currency']) {
            setFieldErrors(prev => ({ ...prev, [name]: undefined }));
        }
    } else {
        setFormData(prev => ({ ...prev, [name]: value as any }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof QuestFormData | 'tier_name' | 'currency', string>> = {};
    if (!formData.title?.trim()) errors.title = 'Title is required.';
    if (!formData.description_md?.trim()) errors.description_md = 'Description is required.';
    if (Number(formData.goal_target) <= 0) errors.goal_target = 'Goal target must be a positive number.';
    if (!formData.start_ts) errors.start_ts = 'Start date is required.';
    if (!formData.end_ts) errors.end_ts = 'End date is required.';
    if (formData.start_ts && formData.end_ts && new Date(formData.end_ts) <= new Date(formData.start_ts)) {
      errors.end_ts = 'End date must be after start date.';
    }
    if ((formData.reward_type === 'points' || formData.reward_type === 'points+nft') && (!formData.reward_points || Number(formData.reward_points) <= 0)) {
      errors.reward_points = 'Valid reward points (positive number) required.';
    }
    if ((formData.reward_type === 'nft' || formData.reward_type === 'points+nft') && !formData.reward_nft_id?.trim()) {
      errors.reward_nft_id = 'Reward NFT ID/Identifier is required.';
    }
    if (formData.goal_type === 'users_at_tier' && !formData.goal_target_metadata?.tier_name?.trim()) {
      errors.tier_name = 'Target Tier Name is required for this goal type.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!questId || !validateForm()) return;

    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    const payload: Partial<QuestFormData> & { start_ts?: string; end_ts?: string } = {
        ...formData,
        goal_target: formData.goal_target ? Number(formData.goal_target) : undefined,
        reward_points: formData.reward_points ? Number(formData.reward_points) : undefined,
    };
    if (formData.start_ts) payload.start_ts = new Date(formData.start_ts).toISOString();
    if (formData.end_ts) payload.end_ts = new Date(formData.end_ts).toISOString();
    
    if (formData.goal_type === 'users_at_tier' && formData.goal_target_metadata?.tier_name) {
        payload.goal_target_metadata = { tier_name: formData.goal_target_metadata.tier_name };
    } else if (formData.goal_type === 'aggregate_spend' && formData.goal_target_metadata?.currency) {
        payload.goal_target_metadata = { currency: formData.goal_target_metadata.currency };
    } else {
        // If metadata is not relevant for the goal_type or not provided, ensure it's not sent or sent as null
        // The API PUT handler should ideally handle $unset if an empty object means remove.
        // For now, we just don't include it if not specifically structured for the current goal_type.
        delete payload.goal_target_metadata; 
    }

    try {
      const response = await fetch(`/api/admin/quests/${questId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update quest: ${response.status}`);
      }
      const updatedQuest = await response.json();
      setSuccessMessage(`Quest "${updatedQuest.title}" updated successfully!`);
      // Optionally, refetch or update form data more precisely if needed
      // fetchQuest(questId); // To get latest, potentially with updated_ts
    } catch (err: any) {
      console.error("Error updating quest:", err);
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return <div className="p-8 text-center text-gray-400">Loading quest data...</div>;
  }
  if (error && !formData.title) { // Show full page error only if quest data couldn't be loaded
    return <div className="p-8 text-center text-red-500">Error: {error} <Link href="/admin/quests" className="underline">Back to list</Link></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-900 min-h-screen text-gray-100">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-white">Edit Community Quest: <span className="text-blue-400">{formData.title || 'Loading...'}</span></h1>
            <Link href="/admin/quests" className="text-blue-400 hover:text-blue-300">&larr; Back to Quests</Link>
        </div>

        {error && <p className="mb-4 p-3 bg-red-700/30 border border-red-500 text-red-300 rounded-md">Error: {error}</p>}
        {successMessage && <p className="mb-4 p-3 bg-green-700/30 border border-green-500 text-green-300 rounded-md">{successMessage}</p>}

        <form onSubmit={handleSubmit} className="space-y-6 bg-gray-800 p-8 rounded-lg shadow-xl">
          {/* Form fields are very similar to create form, ensure value bindings are correct */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">Title</label>
            <input type="text" name="title" id="title" required value={formData.title || ''} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.title ? 'border-red-500' : ''}`} />
            {fieldErrors.title && <p className="mt-1 text-xs text-red-400">{fieldErrors.title}</p>}
          </div>
          <div>
            <label htmlFor="description_md" className="block text-sm font-medium text-gray-300 mb-1">Description (Markdown)</label>
            <textarea name="description_md" id="description_md" rows={4} required value={formData.description_md || ''} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.description_md ? 'border-red-500' : ''}`} />
            {fieldErrors.description_md && <p className="mt-1 text-xs text-red-400">{fieldErrors.description_md}</p>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="goal_type" className="block text-sm font-medium text-gray-300 mb-1">Goal Type</label>
              <select name="goal_type" id="goal_type" required value={formData.goal_type || 'total_referrals'} onChange={handleChange} className="w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5">
                <option value="total_referrals">Total Referrals</option>
                <option value="users_at_tier">Users at Tier</option>
                <option value="aggregate_spend">Aggregate Spend</option>
              </select>
            </div>
            <div>
              <label htmlFor="goal_target" className="block text-sm font-medium text-gray-300 mb-1">Goal Target</label>
              <input type="number" name="goal_target" id="goal_target" required min="1" value={formData.goal_target || ''} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.goal_target ? 'border-red-500' : ''}`} />
              {fieldErrors.goal_target && <p className="mt-1 text-xs text-red-400">{fieldErrors.goal_target}</p>}
            </div>
          </div>

          {formData.goal_type === 'users_at_tier' && (
            <div>
              <label htmlFor="tier_name" className="block text-sm font-medium text-gray-300 mb-1">Target Tier Name</label>
              <input type="text" name="tier_name" id="tier_name" value={formData.goal_target_metadata?.tier_name || ''} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.tier_name ? 'border-red-500' : ''}`} placeholder="e.g., Gold" />
              {fieldErrors.tier_name && <p className="mt-1 text-xs text-red-400">{fieldErrors.tier_name}</p>}
            </div>
          )}
          {formData.goal_type === 'aggregate_spend' && (
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-gray-300 mb-1">Currency/Token (Optional)</label>
              <input type="text" name="currency" id="currency" value={formData.goal_target_metadata?.currency || ''} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.currency ? 'border-red-500' : ''}`} placeholder="e.g., USD"/>
              {fieldErrors.currency && <p className="mt-1 text-xs text-red-400">{fieldErrors.currency}</p>}
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                <select name="status" id="status" value={formData.status || 'scheduled'} onChange={handleChange} className="w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5">
                    <option value="scheduled">Scheduled</option>
                    <option value="active">Active</option>
                    <option value="succeeded">Succeeded</option>
                    <option value="failed">Failed</option>
                    <option value="expired">Expired</option>
                </select>
            </div>
            <div>
              <label htmlFor="reward_type" className="block text-sm font-medium text-gray-300 mb-1">Reward Type</label>
              <select name="reward_type" id="reward_type" required value={formData.reward_type || 'points'} onChange={handleChange} className="w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5">
                <option value="points">Points</option>
                <option value="nft">NFT</option>
                <option value="points+nft">Points + NFT</option>
              </select>
            </div>
         </div>

        {(formData.reward_type === 'points' || formData.reward_type === 'points+nft') && (
            <div className="mt-6 md:mt-0 md:col-span-1">
                <label htmlFor="reward_points" className="block text-sm font-medium text-gray-300 mb-1">Reward Points</label>
                <input type="number" name="reward_points" id="reward_points" min="1" value={formData.reward_points || ''} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.reward_points ? 'border-red-500' : ''}`} />
                {fieldErrors.reward_points && <p className="mt-1 text-xs text-red-400">{fieldErrors.reward_points}</p>}
            </div>
        )}
        {(formData.reward_type === 'nft' || formData.reward_type === 'points+nft') && (
            <div className="mt-6 md:mt-0 md:col-span-1">
                <label htmlFor="reward_nft_id" className="block text-sm font-medium text-gray-300 mb-1">Reward NFT ID/Identifier</label>
                <input type="text" name="reward_nft_id" id="reward_nft_id" value={formData.reward_nft_id || ''} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.reward_nft_id ? 'border-red-500' : ''}`} />
                {fieldErrors.reward_nft_id && <p className="mt-1 text-xs text-red-400">{fieldErrors.reward_nft_id}</p>}
            </div>
        )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div>
              <label htmlFor="start_ts" className="block text-sm font-medium text-gray-300 mb-1">Start Date & Time</label>
              <input type="datetime-local" name="start_ts" id="start_ts" required value={formData.start_ts || ''} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.start_ts ? 'border-red-500' : ''}`} />
              {fieldErrors.start_ts && <p className="mt-1 text-xs text-red-400">{fieldErrors.start_ts}</p>}
            </div>
            <div>
              <label htmlFor="end_ts" className="block text-sm font-medium text-gray-300 mb-1">End Date & Time</label>
              <input type="datetime-local" name="end_ts" id="end_ts" required value={formData.end_ts || ''} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.end_ts ? 'border-red-500' : ''}`} />
              {fieldErrors.end_ts && <p className="mt-1 text-xs text-red-400">{fieldErrors.end_ts}</p>}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Link href="/admin/quests" className="text-gray-400 hover:text-gray-300 px-4 py-2 rounded-md mr-3">Cancel</Link>
            <button type="submit" disabled={isLoading || isFetching} className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-semibold py-2 px-6 rounded-md shadow-md transition-colors">
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 