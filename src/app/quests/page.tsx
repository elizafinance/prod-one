'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button'; // Assuming you use this

// Interface for individual quest data - adjust based on your actual data structure
interface Quest {
  _id: string;
  title: string;
  description?: string;
  status?: string;
  goal_target?: number; // Or whatever your target field is called
  progress?: number;    // Current progress
  reward_description?: string; // Or reward field
  start_ts?: string;    // Dates are often strings from API
  end_ts?: string;
  // Add any other fields you expect from the /api/quests/all endpoint
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
        // IMPORTANT: Use the correct path for your renamed "all quests" API route
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
        <h1 className="text-3xl font-bold mb-6 text-center">Community Quests</h1>
        <p className="text-center text-muted-foreground">Loading quests...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-center">Community Quests</h1>
        <p className="text-center text-red-500">Error: {error}</p>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">Community Quests</h1>
      {quests.length === 0 ? (
        <p className="text-center text-muted-foreground">No quests available at the moment. Check back soon!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quests.map((quest) => (
            <div key={quest._id} className="bg-card p-6 rounded-lg shadow-lg border border-border">
              <h2 className="text-xl font-semibold text-foreground mb-2 truncate" title={quest.title}>{quest.title}</h2>
              {quest.description && <p className="text-sm text-muted-foreground mb-3 min-h-[40px]">{quest.description.substring(0,100)}{quest.description.length > 100 ? '...':''}</p>}
              
              {quest.status && (
                <p className="text-xs mb-1">
                  Status: <span className={`font-medium ${quest.status === 'active' ? 'text-green-500' : 'text-gray-500'}`}>{quest.status}</span>
                </p>
              )}
              {quest.goal_target !== undefined && (
                <p className="text-xs mb-1">Goal: {quest.goal_target.toLocaleString()}</p>
              )}
              {quest.progress !== undefined && (
                 <div className="w-full bg-muted rounded-full h-2 my-2">
                    <div 
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${quest.goal_target && quest.goal_target > 0 ? (quest.progress / quest.goal_target) * 100 : 0}%` }}
                    ></div>
                </div>
              )}
              {quest.reward_description && <p className="text-xs text-amber-500 mb-3">Reward: {quest.reward_description}</p>}
              
              <Link href={`/quests/${quest._id}`} passHref>
                <Button variant="outline" className="w-full mt-auto">
                  View Details
                </Button>
              </Link>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default QuestsPage; 