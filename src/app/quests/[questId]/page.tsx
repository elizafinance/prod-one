'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

// Re-use or adapt ProgressBar from quests/page.tsx
const ProgressBar: React.FC<{ current: number; goal: number; size?: 'normal' | 'large' }> = ({ current, goal, size = 'normal' }) => {
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const heightClass = size === 'large' ? 'h-4' : 'h-2.5';
  return (
    <div className={`w-full bg-gray-700 rounded-full ${heightClass} dark:bg-gray-600 my-2`}>
      <div 
        className={`bg-blue-600 ${heightClass} rounded-full dark:bg-blue-500 transition-all duration-500 ease-out`}
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
};

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
    return <div className="container mx-auto px-4 py-8 text-center text-xl text-muted-foreground">Loading quest details...</div>;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-xl text-red-500 mb-4">Error: {error}</p>
        <Link href="/quests" className="text-blue-400 hover:underline">Back to all quests</Link>
      </div>
    );
  }

  if (!quest) {
    // This case should ideally be covered by the error state if fetch fails with 404
    return <div className="container mx-auto px-4 py-8 text-center text-xl text-muted-foreground">Quest not found.</div>;
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

    const commonButtonClasses = "bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75";

    if (ctaOnClick) {
        return <button onClick={ctaOnClick} className={commonButtonClasses}>{ctaText}</button>;
    }
    return (
        <Link href={ctaLink} legacyBehavior>
            <a className={commonButtonClasses}>{ctaText}</a>
        </Link>
    );
  };

  return (
    <div className="container mx-auto px-4 py-12 bg-background text-foreground">
      <div className="max-w-3xl mx-auto bg-card shadow-2xl rounded-lg p-8 md:p-12">
        <div className="mb-6">
          <Link href="/quests" className="text-sm text-blue-400 hover:text-blue-300">&larr; All Community Quests</Link>
        </div>

        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">{quest.title}</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-sm">
            <div className="bg-muted p-4 rounded-md">
                <p className="text-muted-foreground">Status: <span className={`font-semibold ${quest.status === 'active' ? 'text-success' : quest.status === 'succeeded' ? 'text-[#2B96F1]' : 'text-warning'}`}>{quest.status}</span></p>
            </div>
            <div className="bg-muted p-4 rounded-md">
                 <p className="text-muted-foreground">Time Remaining: <span className="font-semibold text-warning">{calculateRemainingTime(quest.end_ts)}</span></p>
            </div>
        </div>

        <div className="mb-8">
          <h3 className="text-xl font-semibold mb-2 text-foreground">Progress: {quest.progress.toLocaleString()} / {quest.goal.toLocaleString()} <span className="text-muted-foreground text-sm">({getGoalUnit()})</span></h3>
          <ProgressBar current={quest.progress} goal={quest.goal} size="large" />
        </div>

        <div className="mb-8 prose prose-invert prose-sm md:prose-base max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-a:text-[#2B96F1] hover:prose-a:text-blue-300 prose-strong:text-foreground">
          <h3 className="text-xl font-semibold mb-2 text-foreground">Description & Rules:</h3>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{quest.description_md}</ReactMarkdown>
        </div>

        <div className="mb-6 p-4 bg-muted rounded-md">
            {renderRewardInfo()}
        </div>
        
        {quest.status === 'active' && (
            <div className="mt-10 text-center">
                {renderCallToActionButton()}
            </div>
        )}

      </div>
    </div>
  );
} 