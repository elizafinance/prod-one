'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import ProposalCard, { ProposalCardData } from '@/components/proposals/ProposalCard';
import Link from 'next/link';

interface ApiResponse {
  proposals: ProposalCardData[];
  currentPage: number;
  totalPages: number;
  totalProposals: number;
}

export default function ClosedProposalsPage() {
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const proposalsPerPage = parseInt(process.env.NEXT_PUBLIC_PROPOSALS_PER_PAGE || '10', 10);

  const fetchProposals = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/closed?page=${page}&limit=${proposalsPerPage}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch closed proposals');
      }
      const data: ApiResponse = await res.json();
      setApiResponse(data);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Could not load proposals.');
    }
    setIsLoading(false);
  }, [proposalsPerPage]);

  useEffect(() => {
    fetchProposals(currentPage);
  }, [fetchProposals, currentPage]);

  const handleNextPage = () => {
    if (apiResponse && currentPage < apiResponse.totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-background text-foreground">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-700 via-gray-600 to-gray-500">
            Closed Governance Proposals
          </h1>
          <p className="text-muted-foreground mt-3 text-lg max-w-2xl mx-auto">
            Browse proposals that have concluded voting.
          </p>
          <Link href="/proposals" className="text-blue-500 underline text-sm mt-2 inline-block">← Back to Active Proposals</Link>
        </div>

        {isLoading && (
          <div className="text-center py-10">
            <p className="text-xl text-foreground">Loading proposals...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-10 bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-xl text-red-700">Error loading proposals</p>
            <p className="text-muted-foreground mt-2">{error}</p>
            <button
              onClick={() => fetchProposals(currentPage)}
              className="mt-4 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors shadow hover:shadow-md"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && apiResponse && apiResponse.proposals.length === 0 && (
          <div className="text-center py-10">
            <p className="text-xl text-foreground">No closed proposals yet.</p>
          </div>
        )}

        {!isLoading && !error && apiResponse && apiResponse.proposals.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {apiResponse.proposals.map((proposal) => (
              <ProposalCard key={proposal._id} proposal={proposal} onVoteClick={() => {}} />
            ))}
          </div>
        )}

        {apiResponse && apiResponse.totalPages > 1 && (
          <div className="mt-12 flex justify-center items-center space-x-4">
            <button
              onClick={handlePreviousPage}
              disabled={currentPage === 1 || isLoading}
              className="py-2 px-5 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-foreground">
              Page {apiResponse.currentPage} of {apiResponse.totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage === apiResponse.totalPages || isLoading}
              className="py-2 px-5 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </main>
  );
} 