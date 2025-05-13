'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Interface for the form data
interface QuestFormData {
  title: string;
  description_md: string;
  goal_type: 'total_referrals' | 'users_at_tier' | 'aggregate_spend';
  goal_target: number | string; // string for input, number for submission
  goal_target_metadata?: {
    tier_name?: string; // For users_at_tier
    currency?: string;  // For aggregate_spend
  };
  reward_type: 'points' | 'nft' | 'points+nft';
  reward_points?: number | string;
  reward_nft_id?: string;
  start_ts: string; // ISO datetime-local format for input
  end_ts: string;   // ISO datetime-local format for input
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
};

export default function CreateQuestPage() {
  const [formData, setFormData] = useState<QuestFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof QuestFormData | 'tier_name' | 'currency', string>>>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Clear specific field error on change
    if (fieldErrors[name as keyof QuestFormData]) {
        setFieldErrors(prev => ({ ...prev, [name]: undefined }));
    }
    if (name === 'tier_name' || name === 'currency') {
        setFormData(prev => ({ ...prev, goal_target_metadata: { ...(prev.goal_target_metadata || {}), [name]: value } }));
        if (fieldErrors[name as 'tier_name' | 'currency']) {
            setFieldErrors(prev => ({ ...prev, [name]: undefined }));
        }
    } else {
        setFormData(prev => ({ ...prev, [name]: value as any })); // Use as any to bypass strict type on value for mixed inputs
    }
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof QuestFormData | 'tier_name' | 'currency', string>> = {};
    if (!formData.title.trim()) errors.title = 'Title is required.';
    if (!formData.description_md.trim()) errors.description_md = 'Description is required.';
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
    // Currency for aggregate_spend is optional, so no explicit validation unless it has specific format rules.

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
                                : undefined,
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
    <div className="container mx-auto px-4 py-8 bg-gray-900 min-h-screen text-gray-100">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-white">Create New Community Quest</h1>
            <Link href="/admin/quests" className="text-blue-400 hover:text-blue-300">&larr; Back to Quests</Link>
        </div>

        {error && <p className="mb-4 p-3 bg-red-700/30 border border-red-500 text-red-300 rounded-md">Error: {error}</p>}
        {successMessage && <p className="mb-4 p-3 bg-green-700/30 border border-green-500 text-green-300 rounded-md">{successMessage}</p>}

        <form onSubmit={handleSubmit} className="space-y-6 bg-gray-800 p-8 rounded-lg shadow-xl">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-300 mb-1">Title</label>
            <input type="text" name="title" id="title" required value={formData.title} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.title ? 'border-red-500' : ''}`} />
            {fieldErrors.title && <p className="mt-1 text-xs text-red-400">{fieldErrors.title}</p>}
          </div>
          <div>
            <label htmlFor="description_md" className="block text-sm font-medium text-gray-300 mb-1">Description (Markdown)</label>
            <textarea name="description_md" id="description_md" rows={4} required value={formData.description_md} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.description_md ? 'border-red-500' : ''}`} />
            {fieldErrors.description_md && <p className="mt-1 text-xs text-red-400">{fieldErrors.description_md}</p>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="goal_type" className="block text-sm font-medium text-gray-300 mb-1">Goal Type</label>
              <select name="goal_type" id="goal_type" required value={formData.goal_type} onChange={handleChange} className="w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5">
                <option value="total_referrals">Total Referrals</option>
                <option value="users_at_tier">Users at Tier</option>
                <option value="aggregate_spend">Aggregate Spend</option>
              </select>
            </div>
            <div>
              <label htmlFor="goal_target" className="block text-sm font-medium text-gray-300 mb-1">Goal Target (Count/Amount)</label>
              <input type="number" name="goal_target" id="goal_target" required min="1" value={formData.goal_target} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.goal_target ? 'border-red-500' : ''}`} />
              {fieldErrors.goal_target && <p className="mt-1 text-xs text-red-400">{fieldErrors.goal_target}</p>}
            </div>
          </div>

          {formData.goal_type === 'users_at_tier' && (
            <div>
              <label htmlFor="tier_name" className="block text-sm font-medium text-gray-300 mb-1">Target Tier Name (e.g., Gold)</label>
              <input type="text" name="tier_name" id="tier_name" value={formData.goal_target_metadata?.tier_name || ''} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.tier_name ? 'border-red-500' : ''}`} placeholder="e.g., Gold, Platinum" />
              {fieldErrors.tier_name && <p className="mt-1 text-xs text-red-400">{fieldErrors.tier_name}</p>}
            </div>
          )}
          {formData.goal_type === 'aggregate_spend' && (
            <div>
              <label htmlFor="currency" className="block text-sm font-medium text-gray-300 mb-1">Currency/Token (Optional, e.g., USD, POINTS)</label>
              <input type="text" name="currency" id="currency" value={formData.goal_target_metadata?.currency || ''} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.currency ? 'border-red-500' : ''}`} placeholder="e.g., USD, POINTS (leave blank if not specific)" />
              {fieldErrors.currency && <p className="mt-1 text-xs text-red-400">{fieldErrors.currency}</p>}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="reward_type" className="block text-sm font-medium text-gray-300 mb-1">Reward Type</label>
              <select name="reward_type" id="reward_type" required value={formData.reward_type} onChange={handleChange} className="w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5">
                <option value="points">Points</option>
                <option value="nft">NFT</option>
                <option value="points+nft">Points + NFT</option>
              </select>
            </div>
            {(formData.reward_type === 'points' || formData.reward_type === 'points+nft') && (
                <div>
                    <label htmlFor="reward_points" className="block text-sm font-medium text-gray-300 mb-1">Reward Points</label>
                    <input type="number" name="reward_points" id="reward_points" min="1" value={formData.reward_points} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.reward_points ? 'border-red-500' : ''}`} />
                    {fieldErrors.reward_points && <p className="mt-1 text-xs text-red-400">{fieldErrors.reward_points}</p>}
                </div>
            )}
            {(formData.reward_type === 'nft' || formData.reward_type === 'points+nft') && (
                <div>
                    <label htmlFor="reward_nft_id" className="block text-sm font-medium text-gray-300 mb-1">Reward NFT ID/Identifier</label>
                    <input type="text" name="reward_nft_id" id="reward_nft_id" value={formData.reward_nft_id} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.reward_nft_id ? 'border-red-500' : ''}`} />
                    {fieldErrors.reward_nft_id && <p className="mt-1 text-xs text-red-400">{fieldErrors.reward_nft_id}</p>}
                </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="start_ts" className="block text-sm font-medium text-gray-300 mb-1">Start Date & Time</label>
              <input type="datetime-local" name="start_ts" id="start_ts" required value={formData.start_ts} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.start_ts ? 'border-red-500' : ''}`} />
              {fieldErrors.start_ts && <p className="mt-1 text-xs text-red-400">{fieldErrors.start_ts}</p>}
            </div>
            <div>
              <label htmlFor="end_ts" className="block text-sm font-medium text-gray-300 mb-1">End Date & Time</label>
              <input type="datetime-local" name="end_ts" id="end_ts" required value={formData.end_ts} onChange={handleChange} className={`w-full bg-gray-700 border-gray-600 text-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2.5 ${fieldErrors.end_ts ? 'border-red-500' : ''}`} />
              {fieldErrors.end_ts && <p className="mt-1 text-xs text-red-400">{fieldErrors.end_ts}</p>}
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Link href="/admin/quests" className="text-gray-400 hover:text-gray-300 px-4 py-2 rounded-md mr-3">Cancel</Link>
            <button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white font-semibold py-2 px-6 rounded-md shadow-md transition-colors">
              {isLoading ? 'Creating...' : 'Create Quest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 