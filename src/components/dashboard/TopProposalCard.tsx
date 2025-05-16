'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button'; // Assuming you have a Button component

interface TopProposalCardProps {
  // Define props if needed, e.g., proposal data
}

const TopProposalCard: React.FC<TopProposalCardProps> = () => {
  // Placeholder data
  const topProposal = {
    title: "Increase Staking Rewards by 10%",
    id: "prop123",
    currentVotes: 1250,
    targetVotes: 2000,
  };

  return (
    <div className="p-4 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50">
      <h3 className="text-md font-semibold text-foreground mb-2">Top Proposal</h3>
      <div className="mb-3">
        <p className="text-sm text-foreground font-medium">{topProposal.title}</p>
        <p className="text-xs text-muted-foreground">
          Votes: {topProposal.currentVotes} / {topProposal.targetVotes}
        </p>
      </div>
      <Link href="/proposals" passHref>
        <Button size="sm" variant="outline" className="w-full text-xs">
          View All Proposals
        </Button>
      </Link>
    </div>
  );
};

export default TopProposalCard; 