'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TOKEN_LABEL_POINTS } from '@/lib/labels';

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
  scope: 'community' | 'squad';
}

const initialFormData: QuestFormData = {
  title: '',
  description_md: '',
  goal_type: 'total_referrals',
  goal_target: '',
  goal_target_metadata: {},
  reward_type: 'points',
  reward_points: '',
  reward_nft_id: '',
  start_ts: '',
  end_ts: '',
  scope: 'community',
};

export default function CreateQuestPage() {
  const [formData, setFormData] = useState<QuestFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof QuestFormData | 'tier_name' | 'currency' | 'proximity_meters' | 'time_window_minutes', string>>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'proximity_meters' || name === 'time_window_minutes') {
        setFormData(prev => ({
            ...prev,
            goal_target_metadata: { ...prev.goal_target_metadata, [name]: value }
        }));
    } else if (name === 'goal_type') {
        setFormData(prev => ({
            ...prev,
            [name]: value as QuestFormData['goal_type'],
            goal_target_metadata: {},
            scope: (value === 'squad_meetup' || value === 'total_squad_points') ? 'squad' : 'community'
        }));
    } else if (name === 'scope') {
        setFormData(prev => ({ ...prev, [name]: value as QuestFormData['scope'] }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
    if (fieldErrors[name as keyof QuestFormData]) {
        setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof QuestFormData | 'tier_name' | 'currency' | 'proximity_meters' | 'time_window_minutes', string>> = {};
    if (!formData.title.trim()) errors.title = 'Title is required.';
    if (!formData.description_md.trim()) errors.description_md = 'Description is required.';
    if (Number(formData.goal_target) <= 0) errors.goal_target = 'Goal target must be a positive number.';
    if (!formData.start_ts) errors.start_ts = 'Start date is required.';
    if (!formData.end_ts) errors.end_ts = 'End date is required.';
    if (formData.start_ts && formData.end_ts && new Date(formData.end_ts) <= new Date(formData.start_ts)) {
      errors.end_ts = 'End date must be after start date.';
    }
    if ((formData.reward_type === 'points' || formData.reward_type === 'points+nft') && (!formData.reward_points || Number(formData.reward_points) <= 0)) {
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
        if (!formData.goal_target || Number(formData.goal_target) <= 0) {
            errors.goal_target = 'Goal Target (min members) is required and must be positive for squad meetup.';
        }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    if (!validateForm()) {
      return;
    }
    setIsLoading(true);

    const payload = {
        ...formData,
        goal_target: Number(formData.goal_target),
        reward_points: formData.reward_points ? Number(formData.reward_points) : undefined,
        start_ts: new Date(formData.start_ts).toISOString(),
        end_ts: new Date(formData.end_ts).toISOString(),
        goal_target_metadata: formData.goal_type === 'users_at_tier' && formData.goal_target_metadata?.tier_name 
                                ? { tier_name: formData.goal_target_metadata.tier_name }
                                : formData.goal_type === 'aggregate_spend' && formData.goal_target_metadata?.currency
                                ? { currency: formData.goal_target_metadata.currency }
                                : formData.goal_type === 'squad_meetup' && formData.goal_target_metadata
                                ? { 
                                    proximity_meters: Number(formData.goal_target_metadata.proximity_meters),
                                    time_window_minutes: Number(formData.goal_target_metadata.time_window_minutes)
                                  }
                                : undefined,
        scope: formData.scope,
    };

    try {
      const response = await fetch('/api/admin/quests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to create quest: ${response.status}`);
      }

      const newQuest = await response.json();
      setSuccessMessage(`Quest "${newQuest.title}" created successfully! Form reset.`);
      setFormData(initialFormData);
      setFieldErrors({});
    } catch (err: any) {
      console.error("Error creating quest:", err);
      setError(err.message || 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen bg-background">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-foreground">Create New Community Quest</h1>
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
            <input type="text" name="title" id="title" required value={formData.title} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.title ? 'border-destructive' : ''}`} />
            {fieldErrors.title && <p className="mt-1 text-xs text-destructive">{fieldErrors.title}</p>}
          </div>
          <div>
            <label htmlFor="description_md" className="block text-sm font-medium text-foreground mb-1">Description (Markdown)</label>
            <textarea name="description_md" id="description_md" rows={4} required value={formData.description_md} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.description_md ? 'border-destructive' : ''}`} />
            {fieldErrors.description_md && <p className="mt-1 text-xs text-destructive">{fieldErrors.description_md}</p>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="goal_type" className="block text-sm font-medium text-foreground mb-1">Goal Type</label>
              <select name="goal_type" id="goal_type" required value={formData.goal_type} onChange={handleChange} className="w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5">
                {GOAL_TYPES.map(gt => <option key={gt.value} value={gt.value}>{gt.label}</option>)}
              </select>
              {fieldErrors.goal_type && <p className="mt-1 text-xs text-destructive">{fieldErrors.goal_type}</p>}
            </div>
            <div>
              <label htmlFor="goal_target" className="block text-sm font-medium text-foreground mb-1">Goal Target (Count/Amount)</label>
              <input type="number" name="goal_target" id="goal_target" required min="1" value={formData.goal_target} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.goal_target ? 'border-destructive' : ''}`} />
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
                <label htmlFor="goal_target" className="block text-sm font-medium text-foreground mb-1">Min Members for Meetup</label>
                <input type="number" name="goal_target" id="goal_target" required value={formData.goal_target} onChange={handleChange} min="2" className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.goal_target ? 'border-destructive' : ''}`} placeholder="e.g., 2" />
                {fieldErrors.goal_target && <p className="mt-1 text-xs text-destructive">{fieldErrors.goal_target}</p>}
              </div>
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

          <div>
            <label htmlFor="scope" className="block text-sm font-medium text-foreground mb-1">Scope</label>
            <select 
                name="scope" 
                id="scope" 
                required 
                value={formData.scope} 
                onChange={handleChange} 
                className="w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5"
                disabled={formData.goal_type === 'squad_meetup' || formData.goal_type === 'total_squad_points'}
            >
              <option value="community">Community</option>
              <option value="squad">Squad</option>
            </select>
            {fieldErrors.scope && <p className="mt-1 text-xs text-destructive">{fieldErrors.scope}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="reward_type" className="block text-sm font-medium text-foreground mb-1">Reward Type</label>
              <select name="reward_type" id="reward_type" required value={formData.reward_type} onChange={handleChange} className="w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5">
                <option value="points">Points</option>
                <option value="nft">NFT</option>
                <option value="points+nft">Points + NFT</option>
              </select>
            </div>
            {(formData.reward_type === 'points' || formData.reward_type === 'points+nft') && (
                <div>
                    <label htmlFor="reward_points" className="block text-sm font-medium text-foreground mb-1">Reward {TOKEN_LABEL_POINTS}</label>
                    <input type="number" name="reward_points" id="reward_points" min="1" value={formData.reward_points} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.reward_points ? 'border-destructive' : ''}`} />
                    {fieldErrors.reward_points && <p className="mt-1 text-xs text-destructive">{fieldErrors.reward_points}</p>}
                </div>
            )}
            {(formData.reward_type === 'nft' || formData.reward_type === 'points+nft') && (
                <div>
                    <label htmlFor="reward_nft_id" className="block text-sm font-medium text-foreground mb-1">Reward NFT ID/Identifier</label>
                    <input type="text" name="reward_nft_id" id="reward_nft_id" value={formData.reward_nft_id} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.reward_nft_id ? 'border-destructive' : ''}`} />
                    {fieldErrors.reward_nft_id && <p className="mt-1 text-xs text-destructive">{fieldErrors.reward_nft_id}</p>}
                </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="start_ts" className="block text-sm font-medium text-foreground mb-1">Start Date & Time</label>
              <input type="datetime-local" name="start_ts" id="start_ts" required value={formData.start_ts} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.start_ts ? 'border-destructive' : ''}`} />
              {fieldErrors.start_ts && <p className="mt-1 text-xs text-destructive">{fieldErrors.start_ts}</p>}
            </div>
            <div>
              <label htmlFor="end_ts" className="block text-sm font-medium text-foreground mb-1">End Date & Time</label>
              <input type="datetime-local" name="end_ts" id="end_ts" required value={formData.end_ts} onChange={handleChange} className={`w-full bg-background border-input text-foreground rounded-md shadow-sm focus:ring-[#2B96F1] focus:border-[#2B96F1] p-2.5 ${fieldErrors.end_ts ? 'border-destructive' : ''}`} />
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
                  Creating...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
                  </svg>
                  Create Quest
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 