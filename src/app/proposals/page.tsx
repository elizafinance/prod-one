'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import ProposalCard, { ProposalCardData } from '@/components/proposals/ProposalCard'; // Import the real ProposalCard
import VoteModal from '@/components/modals/VoteModal'; // Import VoteModal
import { useSession } from 'next-auth/react'; // Added to get user session

// Define interfaces based on the API response from /api/proposals/active
// These interfaces are now largely defined within ProposalCardData, but ApiResponse is still useful
interface ApiResponse {
  proposals: ProposalCardData[];
  currentPage: number;
  totalPages: number;
  totalProposals: number;
}

const PROPOSALS_REFRESH_INTERVAL = parseInt(process.env.NEXT_PUBLIC_PROPOSALS_REFRESH_INTERVAL || "30000", 10); // Default 30 seconds

export default function ProposalsPage() {
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false); // To indicate background refresh
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const proposalsPerPage = parseInt(process.env.NEXT_PUBLIC_PROPOSALS_PER_PAGE || "10", 10);

  // State for current user's points
  const [currentUserPoints, setCurrentUserPoints] = useState<number | null>(null);
  const { data: session, status: sessionStatus } = useSession<any>(); // Get session
  const typedSession: any = session;

  const [selectedProposalForModal, setSelectedProposalForModal] = useState<ProposalCardData | null>(null);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);

  const fetchProposals = useCallback(async (page: number, isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) {
      setIsLoading(true);
    } else {
      setIsPolling(true);
    }
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
      if (!isBackgroundRefresh) { // Only toast error for initial load or explicit retry
        toast.error(err.message || 'Could not load proposals.');
        setApiResponse(null); 
      } else {
        console.warn("Background proposal refresh failed:", err.message);
      }
    }
    if (!isBackgroundRefresh) {
      setIsLoading(false);
    }
    setIsPolling(false);
  }, [proposalsPerPage]);

  useEffect(() => {
    fetchProposals(currentPage);
  }, [fetchProposals, currentPage]);

  // Polling mechanism
  useEffect(() => {
    if (PROPOSALS_REFRESH_INTERVAL > 0) {
      const intervalId = setInterval(() => {
        console.log('Polling for proposal updates...');
        fetchProposals(currentPage, true); // true for background refresh
      }, PROPOSALS_REFRESH_INTERVAL);
      return () => clearInterval(intervalId);
    }
  }, [fetchProposals, currentPage]); // Rerun if fetchProposals or currentPage changes

  // Fetch current user's points when session is available
  useEffect(() => {
    if (sessionStatus === 'authenticated' && typedSession?.user?.walletAddress) {
      let pointsFound = false;
      const storedUserData = localStorage.getItem('defaiUserData');
      if (storedUserData) {
        try {
          const parsed = JSON.parse(storedUserData);
          if (typeof parsed.points === 'number') {
            setCurrentUserPoints(parsed.points);
            pointsFound = true;
          }
        } catch (e) {
          console.warn("Could not parse user data from LS for points on proposals page", e);
        }
      }

      if (!pointsFound) {
        // Fallback: Fetch from API if not in localStorage or if parsing failed
        console.log(`[ProposalsPage] Fetching points via API for ${typedSession.user.walletAddress}`);
        fetch(`/api/users/points?address=${typedSession.user.walletAddress}`)
          .then(res => {
            if (!res.ok) {
              // Handle non-OK responses (e.g., 404, 500) by throwing an error to be caught below
              throw new Error(`API responded with status ${res.status}`);
            }
            return res.json();
          })
          .then(data => {
            if (typeof data.points === 'number') {
              setCurrentUserPoints(data.points);
            } else {
              setCurrentUserPoints(null); // Explicitly set to null if points not found in API response
              console.warn("[ProposalsPage] Could not fetch user points from API or points field missing/invalid.");
            }
          })
          .catch(err => {
            console.error("[ProposalsPage] Error fetching user points from API:", err);
            setCurrentUserPoints(null); // Set to null on API error
          });
      }
    } else if (sessionStatus === 'unauthenticated') {
        setCurrentUserPoints(null); // Clear points if user logs out
    }
  }, [sessionStatus, typedSession?.user?.walletAddress]); // Ensure dependency

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

  const handleVoteSuccess = () => {
    fetchProposals(currentPage, true); // true for background refresh to avoid full loading spinner
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
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-background text-foreground">
      <div className="w-full max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
            Active Governance Proposals
          </h1>
          <p className="text-muted-foreground mt-3 text-lg max-w-2xl mx-auto">
            Review proposals submitted by eligible squads. Cast your vote to help decide the future!
          </p>
          {isPolling && <p className='text-xs text-gray-500 mt-2 animate-pulse'>Checking for updates...</p>}
        </div>

        {isLoading && (
          <div className="text-center py-10">
            <p className="text-xl text-foreground">Loading proposals...</p>
            {/* TODO: Add a spinner or loading animation here */}
          </div>
        )}

        {error && (
          <div className="text-center py-10 bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-xl text-foreground">Error loading proposals</p>
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
            <p className="text-xl text-foreground">No active proposals at the moment.</p>
            <p className="text-muted-foreground mt-2">Check back later or encourage squads to create new ones!</p>
          </div>
        )}

        {!isLoading && !error && apiResponse && apiResponse.proposals.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {apiResponse.proposals.map(proposal => (
              <ProposalCard key={proposal._id} proposal={proposal} onVoteClick={handleOpenVoteModal} currentUserPoints={currentUserPoints} />
            ))}
          </div>
        )}
        
        {apiResponse && apiResponse.totalPages > 1 && (
            <div className="mt-12 flex justify-center items-center space-x-4">
                <button 
                    onClick={handlePreviousPage} 
                    disabled={currentPage === 1 || isLoading || isPolling}
                    className="py-2 px-5 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                    Previous
                </button>
                <span className="text-foreground">
                    Page {apiResponse.currentPage} of {apiResponse.totalPages}
                </span>
                <button 
                    onClick={handleNextPage} 
                    disabled={currentPage === apiResponse.totalPages || isLoading || isPolling}
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
            currentUserPoints={currentUserPoints} // Pass points to modal
          />
        )}
      </div>
    </main>
  );
} 