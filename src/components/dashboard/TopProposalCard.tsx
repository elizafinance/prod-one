'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ProposalData {
  _id: string;
  title: string;
  description: string;
  createdAt: string; // Dates are often serialized as strings
  currentVotes: number;
  targetVotes: number;
  slug?: string;
  // Add other fields from your Proposal interface if needed
}

const TopProposalCard: React.FC = () => {
  const [topProposal, setTopProposal] = useState<ProposalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopProposal = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/proposals/top');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to fetch: ${response.statusText}`);
        }
        const data: ProposalData = await response.json();
        setTopProposal(data);
      } catch (err: any) {
        console.error("Error fetching top proposal:", err);
        setError(err.message || "Could not load proposal.");
        setTopProposal(null); // Clear any old data
      } finally {
        setIsLoading(false);
      }
    };

    fetchTopProposal();
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50 text-center">
        <p className="text-sm text-muted-foreground">Loading top proposal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50 text-center">
        <p className="text-sm text-red-500">Error: {error}</p>
        <Link href="/proposals" passHref>
          <Button size="sm" variant="outline" className="w-full text-xs mt-2">
            View All Proposals
          </Button>
        </Link>
      </div>
    );
  }

  if (!topProposal) {
    return (
      <div className="p-4 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50 text-center">
        <p className="text-sm text-muted-foreground">No active proposals at the moment.</p>
        <Link href="/proposals" passHref>
          <Button size="sm" variant="outline" className="w-full text-xs mt-2">
            View All Proposals
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50">
      <h3 className="text-md font-semibold text-foreground mb-2">Top Proposal</h3>
      <div className="mb-3">
        <p className="text-sm text-foreground font-medium truncate" title={topProposal.title}>{topProposal.title}</p>
        <p className="text-xs text-muted-foreground">
          Votes: {topProposal.currentVotes?.toLocaleString() || 0} / {topProposal.targetVotes?.toLocaleString() || 'N/A'}
        </p>
      </div>
      <Link href={`/proposals/${topProposal.slug || topProposal._id}`} passHref>
        <Button size="sm" variant="outline" className="w-full text-xs">
          View Proposal
        </Button>
      </Link>
    </div>
  );
};

export default TopProposalCard; 