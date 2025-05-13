'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';

// Re-using the QuestDisplayData interface (ideally, share from a types file)
interface QuestDisplayData {
  _id: string;
  title: string;
  description_md: string;
  goal_type: string;
  goal_target: number;
  reward_type: string;
  reward_points?: number;
  reward_nft_id?: string;
  start_ts: string;
  end_ts: string;
  status: string;
  progress: number;
  goal: number;
}

// Structure of the progress update event from WebSocket
interface QuestProgressUpdateEvent {
  questId: string;
  currentProgress: number;
  goalTarget: number;
}

// Simplified Progress Bar (can be shared from a common components directory)
const MiniProgressBar: React.FC<{ current: number; goal: number }> = ({ current, goal }) => {
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  return (
    <div className="w-full bg-gray-600 rounded-full h-1.5 dark:bg-gray-700 mt-1 mb-2">
      <div 
        className="bg-green-500 h-1.5 rounded-full dark:bg-green-400 transition-all duration-500 ease-out"
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
};

// Simplified remaining time (can be shared)
function calculateRemainingTimeShort(endDateString: string): string {
  const now = new Date();
  const endDate = new Date(endDateString);
  const diff = endDate.getTime() - now.getTime();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days > 1) return `${days}d left`;
  if (days === 1) return `1 day left`;
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  if (hours > 0) return `${hours}h left`;
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  if (minutes > 0) return `${minutes}m left`;
  return 'Soon';
}

interface CommunityQuestsBannerProps {
  maxQuestsToShow?: number;
}

const WEBSOCKET_SERVER_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001';

export default function CommunityQuestsBanner({ maxQuestsToShow = 2 }: CommunityQuestsBannerProps) {
  const [quests, setQuests] = useState<QuestDisplayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Minimal error display for a banner, or could log and show nothing
  const [error, setError] = useState<string | null>(null); 

  useEffect(() => {
    async function fetchActiveQuests() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/quests'); // Fetches all active quests
        if (!response.ok) {
          throw new Error('Failed to fetch quests for banner');
        }
        let data: QuestDisplayData[] = await response.json();
        // Sort by end date (soonest ending first) or by some priority if available
        data.sort((a, b) => new Date(a.end_ts).getTime() - new Date(b.end_ts).getTime());
        setQuests(data.slice(0, maxQuestsToShow));
      } catch (err: any) {
        console.error("Error fetching quests for banner:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetchActiveQuests();
  }, [maxQuestsToShow]);

  useEffect(() => {
    if (typeof window === 'undefined' || quests.length === 0) return;

    const socket: Socket = io(WEBSOCKET_SERVER_URL);

    socket.on('connect', () => {
      console.log('[QuestBanner/WS] Connected:', socket.id);
    });

    socket.on('quest_progress_update', (update: QuestProgressUpdateEvent) => {
      console.log('[QuestBanner/WS] Received quest_progress_update:', update);
      setQuests(prevQuests => 
        prevQuests.map(quest => 
          quest._id === update.questId 
            ? { ...quest, progress: update.currentProgress, goal: update.goalTarget } 
            : quest
        )
      );
    });

    socket.on('disconnect', (reason) => {
      console.log('[QuestBanner/WS] Disconnected:', reason);
    });
    
    socket.on('connect_error', (err) => {
      console.error('[QuestBanner/WS] Connection error:', err);
    });

    return () => {
      console.log('[QuestBanner/WS] Disconnecting WebSocket...');
      socket.disconnect();
    };
    // Re-run effect if the initially fetched quests change, to ensure WS updates apply to the correct set.
  }, [quests.length]); // Dependency on quests.length to re-init if initial quests change (e.g. from 0 to >0)

  if (isLoading) {
    // Render a subtle loader or nothing for a banner
    return <div className="h-10"></div>; // Placeholder height
  }

  if (error || quests.length === 0) {
    // Don't render the banner if there's an error or no quests
    return null;
  }

  return (
    <div className="bg-gray-800/80 backdrop-blur-sm p-4 rounded-lg shadow-md border border-gray-700/50 my-6">
      <h3 className="text-lg font-semibold text-white mb-3">Active Community Quests 🔥</h3>
      <div className="space-y-3">
        {quests.map(quest => (
          <Link href={`/quests/${quest._id}`} key={quest._id} className="block p-3 bg-gray-700/50 hover:bg-gray-600/70 rounded-md transition-colors group">
            <div className="flex justify-between items-center mb-1">
              <h4 className="text-md font-medium text-blue-300 truncate group-hover:underline">{quest.title}</h4>
              <span className="text-xs text-yellow-400 whitespace-nowrap">{calculateRemainingTimeShort(quest.end_ts)}</span>
            </div>
            <p className="text-xs text-gray-400 mb-1 truncate">
              {quest.description_md}
            </p>
            <MiniProgressBar current={quest.progress} goal={quest.goal} />
            <div className="text-xs text-gray-300">
              {quest.progress.toLocaleString()} / {quest.goal.toLocaleString()} 
              <span className="text-gray-500 ml-1">({quest.goal_type === 'users_at_tier' ? 'Users' : quest.goal_type === 'total_referrals' ? 'Referrals' : 'Units'})</span>
            </div>
          </Link>
        ))}
        {quests.length > 0 && (
            <Link href="/quests" className="block text-center text-sm text-blue-400 hover:text-blue-300 hover:underline pt-2">
                View all quests &rarr;
            </Link>
        )}
      </div>
    </div>
  );
} 