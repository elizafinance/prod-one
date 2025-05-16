'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface QuestData {
  id: string; // Changed from _id to id as transformed in API
  title: string;
  description: string;
  reward: string;
  progress?: number; // Current progress, might be fetched or calculated separately if dynamic
  target: number;
  status: string;
  // Add other fields from your CommunityQuest interface if needed
}

const SquadGoalQuestCard: React.FC = () => {
  const [currentQuest, setCurrentQuest] = useState<QuestData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCurrentQuest = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/quests/current-community');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch: ${response.statusText}`);
        }
        const data: QuestData = await response.json();
        setCurrentQuest(data);
      } catch (err: any) {
        console.error("Error fetching current quest:", err);
        setError(err.message || "Could not load quest.");
        setCurrentQuest(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentQuest();
  }, []);

  // --- Squad-specific progress (Placeholder - requires more complex logic) ---
  // This is a simplified placeholder. Real squad progress for a community quest
  // would likely involve fetching squad-specific data related to this quest.
  const squadProgress = currentQuest?.progress ?? (currentQuest ? Math.floor(currentQuest.target / 3) : 0); 
  // ----------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="p-4 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50 text-center">
        <p className="text-sm text-muted-foreground">Loading current squad goal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50 text-center">
        <p className="text-sm text-red-500">Error: {error}</p>
        {/* Optional: Link to a general quests page */}
        <Link href="/quests" passHref>
            <Button size="sm" variant="outline" className="w-full text-xs mt-2">View All Quests</Button>
        </Link>
      </div>
    );
  }

  if (!currentQuest) {
    return (
      <div className="p-4 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50 text-center">
        <p className="text-sm text-muted-foreground">No active squad goals at the moment.</p>
         <Link href="/quests" passHref>
            <Button size="sm" variant="outline" className="w-full text-xs mt-2">Explore Quests</Button>
        </Link>
      </div>
    );
  }

  const progressPercentage = currentQuest.target > 0 ? (squadProgress / currentQuest.target) * 100 : 0;

  return (
    <div className="p-4 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50">
      <h3 className="text-md font-semibold text-foreground mb-2">Current Squad Goal</h3>
      <div className="mb-3">
        <p className="text-sm text-foreground font-medium truncate" title={currentQuest.title}>{currentQuest.title}</p>
        <p className="text-xs text-muted-foreground mb-1 truncate" title={currentQuest.description}>{currentQuest.description}</p>
        <div className="w-full bg-muted rounded-full h-2.5 mb-1">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <p className="text-xs text-muted-foreground text-right">
          {squadProgress?.toLocaleString()} / {currentQuest.target.toLocaleString()} 
        </p>
        <p className="text-xs text-foreground mt-1">
          <span className="font-semibold">Reward:</span> <span className="truncate">{currentQuest.reward}</span>
        </p>
      </div>
      <Link href={`/quests/${currentQuest.id}`} passHref>
        <Button size="sm" variant="outline" className="w-full text-xs">
            View Quest Details
        </Button>
      </Link>
    </div>
  );
};

export default SquadGoalQuestCard; 