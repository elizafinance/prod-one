"use client";

import React, { useEffect, useRef } from 'react';
import { CheckCircleIcon, LockClosedIcon } from '@heroicons/react/24/solid'; // Example icons

export interface Milestone {
  id: string;
  title: string;
  description?: string;
  points?: number;
  pctComplete: number; // 0 to 100
  achievedAt?: Date | string | null;
  icon?: React.ElementType;
  actionUrl?: string; // Optional link for the milestone
}

interface MilestoneTimelineProps {
  milestones: Milestone[];
  // Potentially add callbacks for actions, etc.
}

const MilestoneItem: React.FC<{ milestone: Milestone; isLast: boolean }> = ({ milestone, isLast }) => {
  const isAchieved = milestone.pctComplete >= 100 || !!milestone.achievedAt;
  const IconComponent = milestone.icon || (isAchieved ? CheckCircleIcon : LockClosedIcon);
  const prevAchievedRef = useRef<boolean>(isAchieved);

  useEffect(() => {
    // Trigger confetti only when isAchieved changes from false to true
    if (isAchieved && !prevAchievedRef.current) {
      // Dynamically import canvas-confetti only on the client when needed to avoid SSR issues / circular dependencies
      import('canvas-confetti').then(({ default: confetti }) => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      }).catch(err => {
        console.error('Failed to load confetti library:', err);
      });
    }
    prevAchievedRef.current = isAchieved;
  }, [isAchieved]);

  return (
    <div className="flex items-start">
      {/* Icon and Vertical Line */}
      <div className="flex flex-col items-center mr-4">
        <div 
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
            ${isAchieved ? 'bg-positive text-positive-foreground' : 'bg-muted text-muted-foreground'}
          `}
        >
          <IconComponent className="w-5 h-5" />
        </div>
        {!isLast && (
          <div className={`w-px h-16 mt-1 ${isAchieved ? 'bg-positive' : 'bg-border'}`}></div>
        )}
      </div>

      {/* Milestone Content */}
      <div className={`pb-8 ${isLast ? '' : 'border-b-0'}`}> {/* No border needed if line connects */}
        <div className="flex items-center justify-between">
          <h4 className={`text-md font-semibold ${isAchieved ? 'text-positive-emphasis' : 'text-foreground'}`}>
            {milestone.title}
          </h4>
          {milestone.points && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full
              ${isAchieved ? 'bg-positive/20 text-positive' : 'bg-primary/20 text-primary'}
            `}>
              +{milestone.points} pts
            </span>
          )}
        </div>
        {milestone.description && (
          <p className={`text-sm mt-1 ${isAchieved ? 'text-muted-foreground' : 'text-foreground/80'}`}>
            {milestone.description}
          </p>
        )}
        {/* Progress Bar */}
        {!isAchieved && milestone.pctComplete > 0 && (
          <div className="mt-2 w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full" 
              style={{ width: `${milestone.pctComplete}%` }}
            ></div>
          </div>
        )}
         {isAchieved && milestone.achievedAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Completed: {new Date(milestone.achievedAt).toLocaleDateString()}
          </p>
        )}
        {milestone.actionUrl && !isAchieved && (
          <a 
            href={milestone.actionUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-sm text-primary hover:text-primary/80 font-medium mt-2 inline-block"
          >
            Complete Action
          </a>
        )}
      </div>
    </div>
  );
};

const MilestoneTimeline: React.FC<MilestoneTimelineProps> = ({ milestones }) => {
  if (!milestones || milestones.length === 0) {
    return <p className="text-center text-muted-foreground py-4">No milestones to display.</p>;
  }

  return (
    <div className="space-y-0"> {/* Adjusted space-y to 0 as MilestoneItem handles its own bottom padding/line */}
      {milestones.map((milestone, index) => (
        <MilestoneItem 
          key={milestone.id} 
          milestone={milestone}
          isLast={index === milestones.length - 1} 
        />
      ))}
    </div>
  );
};

export default MilestoneTimeline; 