'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import ProposalCard, { ProposalCardData } from '@/components/proposals/ProposalCard'; // Import the real ProposalCard
import VoteModal from '@/components/modals/VoteModal'; // Import VoteModal

// Define interfaces based on the API response from /api/proposals/active
// These interfaces are now largely defined within ProposalCardData, but ApiResponse is still useful
interface ApiResponse {
  proposals: ProposalCardData[];
  currentPage: number;
  totalPages: number;
  totalProposals: number;
}

export default function ProposalsPage() {
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const proposalsPerPage = parseInt(process.env.NEXT_PUBLIC_PROPOSALS_PER_PAGE || "10", 10);

  const [selectedProposalForModal, setSelectedProposalForModal] = useState<ProposalCardData | null>(null);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);

  const fetchProposals = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/proposals/active?page=${page}&limit=${proposalsPerPage}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch proposals: ${response.statusText}`);
      }
      const data: ApiResponse = await response.json();
      setApiResponse(data);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Could not load proposals.');
      setApiResponse(null); 
    }
    setIsLoading(false);
  }, [proposalsPerPage]);

  useEffect(() => {
    fetchProposals(currentPage);
  }, [fetchProposals, currentPage]);

  const handleOpenVoteModal = (proposalId: string) => {
    const proposalToVote = apiResponse?.proposals.find(p => p._id === proposalId);
    if (proposalToVote) {
      setSelectedProposalForModal(proposalToVote);
      setIsVoteModalOpen(true);
    } else {
      toast.error('Could not find proposal details to vote.');
    }
  };

  const handleCloseVoteModal = () => {
    setIsVoteModalOpen(false);
    setSelectedProposalForModal(null);
  };

  const handleVoteSuccess = (updatedProposalData: ProposalCardData) => {
    // Option 1: Simple refresh of current page data
    fetchProposals(currentPage);
    // Option 2: More granular update (if API returned full updated proposal)
    // setApiResponse(prev => {
    //   if (!prev) return null;
    //   return {
    //     ...prev,
    //     proposals: prev.proposals.map(p => 
    //       p._id === updatedProposalData._id ? updatedProposalData : p
    //     ),
    //   };
    // });
  };

  const handleNextPage = () => {
    if (apiResponse && currentPage < apiResponse.totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-gray-50 text-gray-900">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
            Active Governance Proposals
          </h1>
          <p className="text-gray-600 mt-3 text-lg max-w-2xl mx-auto">
            Review proposals submitted by eligible squads. Cast your vote to help decide the future!
          </p>
        </div>

        {isLoading && (
          <div className="text-center py-10">
            <p className="text-xl text-gray-700">Loading proposals...</p>
            {/* TODO: Add a spinner or loading animation here */}
          </div>
        )}

        {error && (
          <div className="text-center py-10 bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-xl text-red-700">Error loading proposals</p>
            <p className="text-gray-600 mt-2">{error}</p>
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
            <p className="text-xl text-gray-700">No active proposals at the moment.</p>
            <p className="text-gray-600 mt-2">Check back later or encourage squads to create new ones!</p>
          </div>
        )}

        {!isLoading && !error && apiResponse && apiResponse.proposals.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {apiResponse.proposals.map(proposal => (
              <ProposalCard key={proposal._id} proposal={proposal} onVoteClick={handleOpenVoteModal} />
            ))}
          </div>
        )}
        
        {apiResponse && apiResponse.totalPages > 1 && (
            <div className="mt-12 flex justify-center items-center space-x-4">
                <button 
                    onClick={handlePreviousPage} 
                    disabled={currentPage === 1 || isLoading}
                    className="py-2 px-5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                    Previous
                </button>
                <span className="text-gray-700">
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

        {selectedProposalForModal && (
          <VoteModal 
            isOpen={isVoteModalOpen} 
            onClose={handleCloseVoteModal} 
            proposal={selectedProposalForModal} 
            onVoteSuccess={handleVoteSuccess} 
          />
        )}
      </div>
    </main>
  );
} 