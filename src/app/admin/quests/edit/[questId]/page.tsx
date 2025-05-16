'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { TOKEN_LABEL_POINTS } from '@/lib/labels';

// Consistent GOAL_TYPES with the 'new' page
const GOAL_TYPES = [
  { value: 'total_referrals', label: 'Total Referrals (Community)' },
  { value: 'users_at_tier', label: 'Users at Tier (Community)' },
  { value: 'aggregate_spend', label: 'Aggregate Spend (Community)' },
  { value: 'total_squad_points', label: 'Total Squad Points (Squad)' },
  { value: 'squad_meetup', label: 'Squad Meetup (Squad DePIN)' }
];

interface QuestFormData {
  title: string;
  description_md: string;
  goal_type: 'total_referrals' | 'users_at_tier' | 'aggregate_spend' | 'total_squad_points' | 'squad_meetup';
  goal_target: number | string;
  goal_target_metadata?: {
    tier_name?: string;
    currency?: string;
    proximity_meters?: number | string;
    time_window_minutes?: number | string;
  };
  reward_type: 'points' | 'nft' | 'points+nft';
  reward_points?: number | string;
  reward_nft_id?: string;
  start_ts: string; 
  end_ts: string;   
  status?: 'scheduled' | 'active' | 'succeeded' | 'failed' | 'expired'; 
  scope?: 'community' | 'squad'; // Added scope
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
  const questId = params?.questId as string;

  const [formData, setFormData] = useState<Partial<QuestFormData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof QuestFormData | 'tier_name' | 'currency' | 'proximity_meters' | 'time_window_minutes', string>>>({});
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
      // Ensure goal_target_metadata is an object even if null/undefined from API
      const metadata = data.goal_target_metadata || {}; 
      setFormData({
        ...data,
        goal_target: data.goal_target?.toString() || '',
        reward_points: data.reward_points?.toString() || '',
        start_ts: formatDateTimeLocal(data.start_ts),
        end_ts: formatDateTimeLocal(data.end_ts),
        // Ensure all potential metadata fields are strings for form inputs if they exist
        goal_target_metadata: {
            tier_name: metadata.tier_name || '',
            currency: metadata.currency || '',
            proximity_meters: metadata.proximity_meters?.toString() || '',
            time_window_minutes: metadata.time_window_minutes?.toString() || '',
        },
        scope: data.scope || 'community', // Default to community if scope is not set
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
    
    // Clear specific field error on change
    if (fieldErrors[name as keyof QuestFormData | 'tier_name' | 'currency' | 'proximity_meters' | 'time_window_minutes']) {
        setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }

    if (name === 'proximity_meters' || name === 'time_window_minutes' || name === 'tier_name' || name === 'currency') {
        setFormData(prev => ({
            ...prev,
            goal_target_metadata: { ...(prev.goal_target_metadata || {}), [name]: value }
        }));
    } else if (name === 'goal_type') {
        setFormData(prev => ({
            ...prev,
            [name]: value as QuestFormData['goal_type'],
            goal_target_metadata: { // Reset metadata when type changes
                ...(prev.goal_target_metadata || {}),
                tier_name: '', 
                currency: '', 
                proximity_meters: '', 
                time_window_minutes: '' 
            },
            scope: (value === 'squad_meetup' || value === 'total_squad_points') ? 'squad' : (prev.scope || 'community')
        }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value as any }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof QuestFormData | 'tier_name' | 'currency' | 'proximity_meters' | 'time_window_minutes', string>> = {};
    if (!formData.title?.trim()) errors.title = 'Title is required.';
    if (!formData.description_md?.trim()) errors.description_md = 'Description is required.';
    
    const goalTargetNum = Number(formData.goal_target);
    if (isNaN(goalTargetNum) || goalTargetNum <= 0) errors.goal_target = 'Goal target must be a positive number.';

    if (!formData.start_ts) errors.start_ts = 'Start date is required.';
    if (!formData.end_ts) errors.end_ts = 'End date is required.';
    if (formData.start_ts && formData.end_ts && new Date(formData.end_ts) <= new Date(formData.start_ts)) {
      errors.end_ts = 'End date must be after start date.';
    }
    if ((formData.reward_type === 'points' || formData.reward_type === 'points+nft') && (formData.reward_points === undefined || formData.reward_points === '' || Number(formData.reward_points) <= 0)) {
      errors.reward_points = `Valid reward ${TOKEN_LABEL_POINTS} (positive number) required.`;
    }
    if ((formData.reward_type === 'nft' || formData.reward_type === 'points+nft') && !formData.reward_nft_id?.trim()) {
      errors.reward_nft_id = 'Reward NFT ID/Identifier is required.';
    }

    if (formData.goal_type === 'users_at_tier' && !formData.goal_target_metadata?.tier_name?.trim()) {
      errors.tier_name = 'Target Tier Name is required for this goal type.';
    }
    if (formData.goal_type === 'squad_meetup') {
        if (!formData.goal_target_metadata?.proximity_meters || Number(formData.goal_target_metadata.proximity_meters) <= 0) {
            errors.proximity_meters = 'Proximity (meters) is required and must be positive.';
        }
        if (!formData.goal_target_metadata?.time_window_minutes || Number(formData.goal_target_metadata.time_window_minutes) <= 0) {
            errors.time_window_minutes = 'Time window (minutes) is required and must be positive.';
        }
        if (goalTargetNum <= 0 && formData.goal_type === 'squad_meetup') { // goal_target is min members for meetup
             errors.goal_target = 'Min members for meetup must be positive.';
        }
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

    const payload: Partial<QuestFormData> & { start_ts?: string; end_ts?: string; goal_target_metadata?: any } = {
        // Only include fields that have values or are meant to be updated
    };

    // Selectively add fields to the payload to avoid sending undefined for unchanged optional fields
    // or sending empty strings where numbers are expected by API if not touched by user.
    if (formData.title) payload.title = formData.title;
    if (formData.description_md) payload.description_md = formData.description_md;
    if (formData.goal_type) payload.goal_type = formData.goal_type;
    if (formData.goal_target) payload.goal_target = Number(formData.goal_target);
    if (formData.reward_type) payload.reward_type = formData.reward_type;
    if (formData.reward_points) payload.reward_points = Number(formData.reward_points);
    if (formData.reward_nft_id !== undefined) payload.reward_nft_id = formData.reward_nft_id; // Allow empty string to clear
    if (formData.start_ts) payload.start_ts = new Date(formData.start_ts).toISOString();
    if (formData.end_ts) payload.end_ts = new Date(formData.end_ts).toISOString();
    if (formData.status) payload.status = formData.status;
    if (formData.scope) payload.scope = formData.scope;

    // Handle metadata carefully
    let currentMetadata: any = {};
    let metadataIsSet = false;
    if (formData.goal_type === 'users_at_tier' && formData.goal_target_metadata?.tier_name) {
        currentMetadata.tier_name = formData.goal_target_metadata.tier_name;
        metadataIsSet = true;
    } else if (formData.goal_type === 'aggregate_spend' && formData.goal_target_metadata?.currency) {
        currentMetadata.currency = formData.goal_target_metadata.currency;
        metadataIsSet = true;
    } else if (formData.goal_type === 'squad_meetup' && formData.goal_target_metadata) {
        if (formData.goal_target_metadata.proximity_meters) currentMetadata.proximity_meters = Number(formData.goal_target_metadata.proximity_meters);
        if (formData.goal_target_metadata.time_window_minutes) currentMetadata.time_window_minutes = Number(formData.goal_target_metadata.time_window_minutes);
        if (Object.keys(currentMetadata).length > 0) metadataIsSet = true;
    }
    if (metadataIsSet) {
        payload.goal_target_metadata = currentMetadata;
    } else if (formData.goal_type && formData.goal_type !== 'users_at_tier' && formData.goal_type !== 'aggregate_spend' && formData.goal_type !== 'squad_meetup') {
        // If goal type does not use metadata, explicitly ensure it's not sent or is nulled if API supports $unset
        payload.goal_target_metadata = {}; // Or consider not setting it if API handles partial updates well
    }
    
    try {
      const response = await fetch(`/api/admin/quests/${questId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update quest: ${response.statusText} (${response.status})`);
      }
      const updatedQuest = await response.json();
      setSuccessMessage(`Quest "${updatedQuest.title}" updated successfully!`);
      // Optionally, update form data with response to reflect any backend transformations (e.g. updated_ts)
      // For now, we assume success means our payload was accepted.
    } catch (err: any) {
      console.error("Error updating quest:", err);
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return <div className="p-8 text-center text-muted-foreground">Loading quest data...</div>;
  }
  if (error && !formData.title) { 
    return <div className="p-8 text-center text-destructive">Error: {error} <Link href="/admin/quests" className="underline">Back to list</Link></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen bg-background">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">Edit Community Quest: <span className="text-[#2B96F1]">{formData.title || 'Loading...'}</span></h1>
            <Link href="/admin/quests" className="text-[#2B96F1] hover:text-blue-600 transition-colors flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Quests
            </Link>
        </div>

        {error && <p className="mb-4 p-3 bg-destructive/30 border border-destructive text-destructive-foreground rounded-md">Error: {error}</p>}
        {successMessage && <p className="mb-4 p-3 bg-green-700/30 border border-green-500 text-green-300 rounded-md">{successMessage}</p>}

        <form onSubmit={handleSubmit} className="space-y-6 bg-card p-8 rounded-lg shadow-xl border border-border">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-foreground mb-1">Title</label>
            <input type="text" name="title" id="title" required value={formData.title || ''} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.title ? 'border-destructive' : ''}`} />
            {fieldErrors.title && <p className="mt-1 text-xs text-destructive">{fieldErrors.title}</p>}
          </div>
          <div>
            <label htmlFor="description_md" className="block text-sm font-medium text-foreground mb-1">Description (Markdown)</label>
            <textarea name="description_md" id="description_md" rows={4} required value={formData.description_md || ''} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.description_md ? 'border-destructive' : ''}`} />
            {fieldErrors.description_md && <p className="mt-1 text-xs text-destructive">{fieldErrors.description_md}</p>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="goal_type" className="block text-sm font-medium text-foreground mb-1">Goal Type</label>
              <select name="goal_type" id="goal_type" required value={formData.goal_type || 'total_referrals'} onChange={handleChange} className="w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5">
                {GOAL_TYPES.map(gt => <option key={gt.value} value={gt.value}>{gt.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="goal_target" className="block text-sm font-medium text-foreground mb-1">Goal Target {formData.goal_type === 'squad_meetup' ? '(Min Members)' : '(Count/Amount)'}</label>
              <input type="number" name="goal_target" id="goal_target" required min="1" value={formData.goal_target || ''} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.goal_target ? 'border-destructive' : ''}`} />
              {fieldErrors.goal_target && <p className="mt-1 text-xs text-destructive">{fieldErrors.goal_target}</p>}
            </div>
          </div>

          {formData.goal_type === 'users_at_tier' && (
            <div>
              <label htmlFor="tier_name" className="block text-sm font-medium text-foreground mb-1">Target Tier Name (e.g., Gold)</label>
              <input type="text" name="tier_name" id="tier_name" value={formData.goal_target_metadata?.tier_name || ''} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.tier_name ? 'border-destructive' : ''}`} placeholder="e.g., Gold, Platinum" />
              {fieldErrors.tier_name && <p className="mt-1 text-xs text-destructive">{fieldErrors.tier_name}</p>}
            </div>
          )}
          {formData.goal_type === 'aggregate_spend' && (
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-foreground mb-1">Currency/Token (Optional, e.g., USD, POINTS)</label>
              <input type="text" name="currency" id="currency" value={formData.goal_target_metadata?.currency || ''} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.currency ? 'border-destructive' : ''}`} placeholder="e.g., USD, POINTS (leave blank if not specific)" />
              {fieldErrors.currency && <p className="mt-1 text-xs text-destructive">{fieldErrors.currency}</p>}
            </div>
          )}
          {formData.goal_type === 'squad_meetup' && (
            <>
              <div>
                <label htmlFor="proximity_meters" className="block text-sm font-medium text-foreground mb-1">Proximity (meters)</label>
                <input type="number" name="proximity_meters" id="proximity_meters" required value={formData.goal_target_metadata?.proximity_meters || ''} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.proximity_meters ? 'border-destructive' : ''}`} placeholder="e.g., 100" />
                {fieldErrors.proximity_meters && <p className="mt-1 text-xs text-destructive">{fieldErrors.proximity_meters}</p>}
              </div>
              <div>
                <label htmlFor="time_window_minutes" className="block text-sm font-medium text-foreground mb-1">Time Window (minutes)</label>
                <input type="number" name="time_window_minutes" id="time_window_minutes" required value={formData.goal_target_metadata?.time_window_minutes || ''} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.time_window_minutes ? 'border-destructive' : ''}`} placeholder="e.g., 10" />
                {fieldErrors.time_window_minutes && <p className="mt-1 text-xs text-destructive">{fieldErrors.time_window_minutes}</p>}
              </div>
            </>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
                <label htmlFor="status" className="block text-sm font-medium text-foreground mb-1">Status</label>
                <select name="status" id="status" value={formData.status || 'scheduled'} onChange={handleChange} className="w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5">
                    <option value="scheduled">Scheduled</option>
                    <option value="active">Active</option>
                    <option value="succeeded">Succeeded</option>
                    <option value="failed">Failed</option>
                    <option value="expired">Expired</option>
                </select>
            </div>
            <div>
              <label htmlFor="scope" className="block text-sm font-medium text-foreground mb-1">Scope</label>
              <select 
                  name="scope" 
                  id="scope" 
                  required 
                  value={formData.scope || 'community'} 
                  onChange={handleChange} 
                  className="w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5"
                  disabled={formData.goal_type === 'squad_meetup' || formData.goal_type === 'total_squad_points'}
              >
                <option value="community">Community</option>
                <option value="squad">Squad</option>
              </select>
            </div>
         </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="reward_type" className="block text-sm font-medium text-foreground mb-1">Reward Type</label>
              <select name="reward_type" id="reward_type" required value={formData.reward_type || 'points'} onChange={handleChange} className="w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5">
                <option value="points">Points</option>
                <option value="nft">NFT</option>
                <option value="points+nft">Points + NFT</option>
              </select>
            </div>
            {(formData.reward_type === 'points' || formData.reward_type === 'points+nft') && (
                <div>
                    <label htmlFor="reward_points" className="block text-sm font-medium text-foreground mb-1">Reward {TOKEN_LABEL_POINTS}</label>
                    <input type="number" name="reward_points" id="reward_points" min="1" value={formData.reward_points || ''} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.reward_points ? 'border-destructive' : ''}`} />
                    {fieldErrors.reward_points && <p className="mt-1 text-xs text-destructive">{fieldErrors.reward_points}</p>}
                </div>
            )}
            {(formData.reward_type === 'nft' || formData.reward_type === 'points+nft') && (
                <div>
                    <label htmlFor="reward_nft_id" className="block text-sm font-medium text-foreground mb-1">Reward NFT ID/Identifier</label>
                    <input type="text" name="reward_nft_id" id="reward_nft_id" value={formData.reward_nft_id || ''} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.reward_nft_id ? 'border-destructive' : ''}`} />
                    {fieldErrors.reward_nft_id && <p className="mt-1 text-xs text-destructive">{fieldErrors.reward_nft_id}</p>}
                </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="start_ts" className="block text-sm font-medium text-foreground mb-1">Start Date & Time</label>
              <input type="datetime-local" name="start_ts" id="start_ts" required value={formData.start_ts || ''} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.start_ts ? 'border-destructive' : ''}`} />
              {fieldErrors.start_ts && <p className="mt-1 text-xs text-destructive">{fieldErrors.start_ts}</p>}
            </div>
            <div>
              <label htmlFor="end_ts" className="block text-sm font-medium text-foreground mb-1">End Date & Time</label>
              <input type="datetime-local" name="end_ts" id="end_ts" required value={formData.end_ts || ''} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.end_ts ? 'border-destructive' : ''}`} />
              {fieldErrors.end_ts && <p className="mt-1 text-xs text-destructive">{fieldErrors.end_ts}</p>}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Link href="/admin/quests" className="text-muted-foreground hover:text-foreground px-4 py-2 rounded-md mr-3 transition-colors">Cancel</Link>
            <button type="submit" disabled={isLoading} className="bg-[#2B96F1] hover:bg-blue-600 disabled:bg-blue-800 text-white font-semibold py-2 px-6 rounded-md shadow-md transition-colors flex items-center gap-2">
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 