"use client";
import React from 'react';

// Define a minimal Milestone type if it's used by props, to avoid import errors
export interface Milestone {
  id: string;
  title: string;
  [key: string]: any; // Allow other properties
}

// Minimal placeholder for MilestoneTimeline
const MilestoneTimeline: React.FC<{ milestones?: Milestone[]; [key: string]: any; }> = ({ milestones }) => {
  return (
    <div style={{ border: '1px dashed #ccc', padding: '10px', margin: '10px 0', textAlign: 'center' }}>
      <p style={{color: '#888', fontSize: '0.9em'}}>Milestone Timeline Placeholder</p>
      {milestones && milestones.map(ms => <div key={ms.id} style={{fontSize: '0.8em', color: '#aaa'}}>{ms.title}</div>)}
    </div>
  );
};
MilestoneTimeline.displayName = 'MilestoneTimeline';

export default MilestoneTimeline; 