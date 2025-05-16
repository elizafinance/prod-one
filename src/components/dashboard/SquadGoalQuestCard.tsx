'use client';

import React from 'react';
import { Button } from '@/components/ui/button'; // Assuming you have a Button component

interface SquadGoalQuestCardProps {
  // Define props if needed, e.g., quest data
}

const SquadGoalQuestCard: React.FC<SquadGoalQuestCardProps> = () => {
  // Placeholder data
  const currentQuest = {
    title: "Achieve 5000 Squad Points!",
    description: "Work together with your squad to accumulate 5000 points by the end of the week.",
    reward: "Rare NFT Badge + 1000 Bonus Points",
    progress: 2850,
    target: 5000,
  };

  return (
    <div className="p-4 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50">
      <h3 className="text-md font-semibold text-foreground mb-2">Current Squad Goal</h3>
      <div className="mb-3">
        <p className="text-sm text-foreground font-medium">{currentQuest.title}</p>
        <p className="text-xs text-muted-foreground mb-1">{currentQuest.description}</p>
        <div className="w-full bg-muted rounded-full h-2.5 mb-1">
          <div 
            className="bg-blue-600 h-2.5 rounded-full"
            style={{ width: `${(currentQuest.progress / currentQuest.target) * 100}%` }}
          ></div>
        </div>
        <p className="text-xs text-muted-foreground text-right">
          {currentQuest.progress} / {currentQuest.target} Points
        </p>
        <p className="text-xs text-foreground mt-1">
          <span className="font-semibold">Reward:</span> {currentQuest.reward}
        </p>
      </div>
      {/* You might want a button to view more details or specific actions */}
      {/* <Button size="sm" variant="outline" className="w-full text-xs">View Quest Details</Button> */}
    </div>
  );
};

export default SquadGoalQuestCard; 