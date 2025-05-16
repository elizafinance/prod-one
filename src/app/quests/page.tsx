'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon } from '@heroicons/react/24/solid'; // For back button

// Interface for individual quest data from /api/quests/all
interface Quest {
  _id: string;
  title: string;
  description?: string;         // Full description, possibly markdown
  status?: 'scheduled' | 'active' | 'completed' | 'expired' | string; // Allow more statuses
  goal_target?: number;
  progress?: number;            // Overall progress if available from API
  goal_units?: string;          // e.g., "Units", "Points", "Referrals"
  reward_description?: string;  // Text description of the reward
  reward_points?: number;       // Specific points if applicable
  start_ts?: string;
  end_ts?: string;
  // Add other relevant fields returned by your API
  // For example, if your API returns a pre-formatted rules string:
  // rules?: string;
}

// Helper to calculate remaining time
function calculateRemainingTime(endDateString?: string): string {
  if (!endDateString) return 'N/A';
  const now = new Date();
  const endDate = new Date(endDateString);
  const diff = endDate.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Ended';
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);

  if (days > 7) return `> 7 days left`;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  if (minutes > 0) return `${minutes}m left`;
  return 'Ending soon';
}

const QuestsPage = () => {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuests = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/quests/all'); 
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch quests: ${response.statusText}`);
        }
        const data: Quest[] = await response.json();
        setQuests(data);
      } catch (err: any) {
        console.error("Error fetching quests:", err);
        setError(err.message || "Could not load quests.");
        setQuests([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuests();
  }, []);

  if (isLoading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-foreground">Community Quests</h1>
        <p className="text-center text-muted-foreground">Loading quests...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-foreground">Community Quests</h1>
        <p className="text-center text-red-500">Error: {error}</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Community Quests
        </h1>
        <p className="mt-3 text-lg text-muted-foreground sm:mt-4">
          Participate in community-wide challenges and earn rewards!
        </p>
      </div>

      {quests.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">No quests available at the moment. Check back soon!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {quests.map((quest) => {
            const progressPercentage = quest.goal_target && quest.goal_target > 0 && quest.progress !== undefined
              ? (quest.progress / quest.goal_target) * 100
              : 0;
            const timeRemaining = calculateRemainingTime(quest.end_ts);
            const isExpired = timeRemaining === 'Ended';

            return (
              <div key={quest._id} className="bg-card border border-border rounded-xl shadow-lg overflow-hidden flex flex-col h-full">
                <div className="p-6 flex-grow">
                  <div className="mb-4">
                    <h2 className="text-2xl font-semibold text-foreground mb-1 group-hover:text-primary transition-colors" title={quest.title}>{quest.title}</h2>
                    {quest.status && (
                       <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full mb-2 ${quest.status === 'active' ? 'bg-green-100 text-green-700' : quest.status === 'scheduled' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                         {quest.status.charAt(0).toUpperCase() + quest.status.slice(1)}
                       </span>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-3" title={quest.description}>{quest.description || 'No description provided.'}</p>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div>
                      <div className="flex justify-between text-sm text-muted-foreground mb-1">
                        <span>Progress</span>
                        <span>{quest.progress?.toLocaleString() || 0} / {quest.goal_target?.toLocaleString() || 'N/A'} {quest.goal_units || ''}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2.5">
                        <div 
                          className={`h-2.5 rounded-full ${isExpired ? 'bg-gray-400' : 'bg-primary'} transition-all duration-500 ease-out`}
                          style={{ width: `${progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                    {quest.end_ts && (
                        <div className="text-sm text-muted-foreground">
                            Time Remaining: <span className={`font-medium ${isExpired ? 'text-red-500' : 'text-foreground'}`}>{timeRemaining}</span>
                        </div>
                    )}
                  </div>

                  {(quest.reward_points || quest.reward_description) && (
                    <div className="mt-3 pt-3 border-t border-border">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">REWARD</h4>
                        {quest.reward_points && <p className="text-sm text-primary font-semibold">{quest.reward_points.toLocaleString()} Points</p>}
                        {quest.reward_description && !quest.reward_points && <p className="text-sm text-primary font-semibold">{quest.reward_description}</p>}
                         {quest.reward_description && quest.reward_points && <p className="text-xs text-muted-foreground">+ {quest.reward_description}</p>}
                    </div>
                  )}
                </div>
                
                <div className="p-6 border-t border-border mt-auto">
                  <Link href={`/quests/${quest._id}`} passHref>
                    <Button variant={isExpired ? "secondary" : "default"} className="w-full" disabled={isExpired && quest.status !== 'completed'}>
                      {isExpired && quest.status !== 'completed' ? 'Quest Ended' : 'View Quest Details'}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
};

export default QuestsPage; 