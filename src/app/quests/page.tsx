'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { useCommunityQuestProgressStore, useSquadQuestProgressStore, QuestProgressData } from '@/store/useQuestProgressStore'; // Adjust path if needed

// Define the structure of the quest data we expect from the API
interface QuestDisplayData {
  _id: string;
  title: string;
  description_md: string; // Assuming markdown, will need a parser component later
  goal_type: string;
  goal_target: number; // The original goal target from DB
  reward_type: string;
  reward_points?: number;
  reward_nft_id?: string;
  start_ts: string; // ISO date string
  end_ts: string;   // ISO date string
  status: string;
  // Fields added by the API endpoint, resolved from Redis or quest data
  progress: number; 
  goal: number; // This is the `goal_target` value used for display, might be same as quest.goal_target
}

// Structure of the progress update event from WebSocket
interface QuestProgressUpdateEvent {
  questId: string;
  currentProgress: number;
  goalTarget: number; // This might be redundant if `goal` in QuestDisplayData is always up-to-date
  // Include other fields if the event sends more, e.g., lastContributorWalletAddress, updatedAt
}

// Helper to calculate remaining time (simplified)
function calculateRemainingTime(endDateString: string): string {
  const now = new Date();
  const endDate = new Date(endDateString);
  const diff = endDate.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Ended';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return 'Ending soon';
}

// Simple Progress Bar Component
const ProgressBar: React.FC<{ current: number; goal: number }> = ({ current, goal }) => {
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  return (
    <div className="w-full bg-gray-700 rounded-full h-2.5 dark:bg-gray-600 my-2">
      <div 
        className="bg-blue-600 h-2.5 rounded-full dark:bg-blue-500 transition-all duration-500 ease-out"
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
};

export default function QuestsPage() {
  const [quests, setQuests] = useState<QuestDisplayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchQuests() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/quests');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch quests: ${response.status}`);
        }
        const data: QuestDisplayData[] = await response.json();
        setQuests(data);
      } catch (err: any) {
        console.error("Error fetching quests:", err);
        setError(err.message || 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    }
    fetchQuests();
  }, []);

  useEffect(() => {
    // Initialize stores or fetch initial data if needed
    const { setCommunityQuestProgress } = useCommunityQuestProgressStore.getState();
    const { setSquadQuestProgress } = useSquadQuestProgressStore.getState();

    const WEBSOCKET_SERVER_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001';
    console.log(`[QuestsPage/WS] Connecting to WebSocket server: ${WEBSOCKET_SERVER_URL}`);

    const socket: Socket = io(WEBSOCKET_SERVER_URL, {
        // transports: ['websocket'], // Optional: force websocket only
        // reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
        console.log('[QuestsPage/WS] Connected to WebSocket server:', socket.id);
    });

    socket.on('disconnect', (reason) => {
        console.log('[QuestsPage/WS] Disconnected from WebSocket server:', reason);
    });

    socket.on('connect_error', (error) => {
        console.error('[QuestsPage/WS] Connection Error:', error);
    });

    // Listener for quest progress updates
    socket.on('quest_progress_update', (data: QuestProgressData) => {
        console.log('[QuestsPage/WS] Received quest_progress_update:', data);
        if (data.scope === 'squad' && data.squadId) {
            setSquadQuestProgress(data);
        } else if (data.scope === 'community') {
            setCommunityQuestProgress(data);
        } else {
            console.warn('[QuestsPage/WS] Received progress update with unknown scope or missing squadId for squad scope:', data);
        }
    });

    return () => {
        console.log('[QuestsPage/WS] Disconnecting WebSocket...');
        socket.disconnect();
    };
}, []); // Ensure correct dependencies if any external setters are used directly in effect

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-xl text-gray-400">Loading community quests...</p>
        {/* You can add a spinner or skeleton loader here */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-xl text-red-500">Error loading quests: {error}</p>
      </div>
    );
  }

  if (quests.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-4xl font-bold mb-8 text-white">Community Quests</h1>
        <p className="text-xl text-gray-400">No active community quests at the moment. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-12 text-center text-white">Community Quests</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {quests.map((quest) => (
          <Link href={`/quests/${quest._id}`} key={quest._id} className="block group">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg hover:shadow-blue-500/30 transition-all duration-300 h-full flex flex-col">
              <h2 className="text-2xl font-semibold mb-3 text-blue-400 group-hover:text-blue-300">{quest.title}</h2>
              {/* For Markdown, you'd use a library like react-markdown */}
              <p className="text-gray-400 mb-4 text-sm leading-relaxed flex-grow min-h-[60px]">
                {quest.description_md.substring(0, 150)}{quest.description_md.length > 150 ? '...' : ''}
              </p>
              
              <div className="mt-auto">
                <div className="mb-2">
                  <span className="text-sm font-medium text-gray-300">
                    Progress: {quest.progress.toLocaleString()} / {quest.goal.toLocaleString()} 
                    ({quest.goal_type === 'users_at_tier' ? 'Users' : quest.goal_type === 'total_referrals' ? 'Referrals' : 'Units'})
                  </span>
                  <ProgressBar current={quest.progress} goal={quest.goal} />
                </div>
                
                <div className="text-xs text-gray-500 mb-1">
                  <span>Ends: {new Date(quest.end_ts).toLocaleDateString()}</span>
                </div>
                <div className="text-sm font-bold text-yellow-400">
                  {calculateRemainingTime(quest.end_ts)}
                </div>
                {/* TODO: Add reward display logic */}
                {/* <p className="text-xs text-green-400 mt-2">Reward: {quest.reward_points} points</p> */}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
} 