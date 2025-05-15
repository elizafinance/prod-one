"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { SquadDocument, ISquadJoinRequest } from '@/lib/mongodb'; // Added ISquadJoinRequest
import RequestToJoinModal from '@/components/modals/RequestToJoinModal'; // Import the new modal

interface SquadBrowseEntry extends SquadDocument {
  memberCount: number; // Added from leaderboard API projection
  totalSquadPoints: number; // Added from leaderboard API projection
}

interface MySquadInfo {
  squadId?: string | null;
}

// Define a simple structure for the request object we might fetch
interface UserJoinRequestSummary {
  squadId: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default function BrowseSquadsPage() {
  const [squads, setSquads] = useState<SquadBrowseEntry[]>([]);
  const [mySquadInfo, setMySquadInfo] = useState<MySquadInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // const [isJoining, setIsJoining] = useState<string | null>(null); // Old state for direct join
  const [error, setError] = useState<string | null>(null);
  const { publicKey, connected } = useWallet();
  const router = useRouter();

  // New state for request to join modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedSquadForRequest, setSelectedSquadForRequest] = useState<SquadBrowseEntry | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // New state for user's pending join requests
  const [currentUserPendingRequests, setCurrentUserPendingRequests] = useState<UserJoinRequestSummary[]>([]);

  const fetchSquadsAndUserData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const leaderboardResponse = await fetch('/api/squads/leaderboard');
      if (!leaderboardResponse.ok) {
        throw new Error('Failed to fetch squads list');
      }
      const leaderboardData = await leaderboardResponse.json();
      setSquads(leaderboardData as SquadBrowseEntry[]);

      if (connected && publicKey) {
        const userWalletAddress = publicKey.toBase58();
        // Fetch current user's squad status
        const mySquadResponse = await fetch(`/api/squads/my-squad?userWalletAddress=${encodeURIComponent(userWalletAddress)}`);
        if (mySquadResponse.ok) {
          const mySquadData = await mySquadResponse.json();
          setMySquadInfo({ squadId: mySquadData.squad?.squadId });
        } else {
          setMySquadInfo(null);
        }

        // Fetch user's pending join requests
        const pendingRequestsResponse = await fetch('/api/squads/join-requests/my-pending');
        if (pendingRequestsResponse.ok) {
          const pendingData = await pendingRequestsResponse.json();
          setCurrentUserPendingRequests(pendingData.requests || []);
        } else {
          console.error("Failed to fetch user's pending requests:", await pendingRequestsResponse.text());
          setCurrentUserPendingRequests([]);
        }
      } else {
        setMySquadInfo(null);
        setCurrentUserPendingRequests([]);
      }
    } catch (err) {
      setError((err as Error).message || 'Could not load squads data.');
      console.error(err);
    }
    setIsLoading(false);
  }, [connected, publicKey]);

  useEffect(() => {
    fetchSquadsAndUserData();
  }, [fetchSquadsAndUserData]);

  const handleOpenRequestModal = (squad: SquadBrowseEntry) => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet to request to join a squad.");
      return;
    }
    if (mySquadInfo?.squadId) {
      toast.info("You are already in a squad. Leave your current squad to request to join another.");
      return;
    }
    setSelectedSquadForRequest(squad);
    setIsRequestModalOpen(true);
  };

  const handleSubmitJoinRequest = async (squadIdToRequest: string, message?: string) => {
    if (!publicKey) return;
    setIsSubmittingRequest(true);
    try {
      const response = await fetch(`/api/squads/${squadIdToRequest}/request-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Request sent successfully!");
        setIsRequestModalOpen(false);
        // Add to local pending requests state (optimistic or refetch)
        setCurrentUserPendingRequests(prev => [...prev, { squadId: squadIdToRequest, status: 'pending' }]);
        // fetchSquadsAndUserData(); // Or just refetch user specific data
      } else {
        toast.error(data.error || "Failed to send request.");
      }
    } catch (err) {
      toast.error("An unexpected error occurred while sending request.");
      console.error("Request join error:", err);
    }
    setIsSubmittingRequest(false);
  };

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-white text-gray-900">
      <div className="w-full max-w-4xl mx-auto py-8 sm:py-12">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600">
            Join a Squad
          </h1>
          <div className="space-x-3">
            <Link href="/squads/create" passHref>
                <button className="bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out">
                Create Squad
                </button>
            </Link>
            <Link href="/" passHref>
                <button className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out">
                Back to Dashboard
                </button>
            </Link>
          </div>
        </div>

        {isLoading && (
          <div className="text-center py-10"><p className="text-xl text-gray-600">Searching for Squads...</p><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mt-4"></div></div>
        )}
        {error && <p className="text-center text-red-700 bg-red-100 p-4 rounded-lg border border-red-300">Error: {error}</p>}
        
        {!isLoading && !error && squads.length === 0 && (
          <div className="text-center py-10 bg-gray-100 p-6 rounded-lg shadow-lg border border-gray-200">
            <p className="text-2xl text-gray-700 mb-3">No squads found. Why not start your own?</p>
          </div>
        )}

        {!isLoading && !error && squads.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {squads.map((squad) => {
              const hasPendingRequestForThisSquad = currentUserPendingRequests.some(req => req.squadId === squad.squadId && req.status === 'pending');
              const isSquadFull = squad.memberCount >= (parseInt(process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || '50')); // Default to 50 if env not set

              return (
                <div key={squad.squadId} className="bg-white border border-gray-200 shadow-lg rounded-lg p-6 flex flex-col justify-between min-h-[280px]">
                  <div>
                    <h2 className="text-2xl font-bold text-sky-700 mb-2">{squad.name}</h2>
                    {squad.description && <p className="text-sm text-gray-600 mb-3 line-clamp-3">{squad.description}</p>}
                    <p className="text-sm text-gray-500">Leader: <span className="font-mono text-xs">{squad.leaderWalletAddress.substring(0,6)}...</span></p>
                    <p className="text-sm text-gray-500">Members: {squad.memberCount} / {process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || 50}</p>
                    <p className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-teal-500 mt-1">Points: {squad.totalSquadPoints.toLocaleString()}</p>
                  </div>
                  <div className="mt-4 space-y-2">
                    {(!connected || !publicKey) ? (
                      <p className="text-xs text-center text-orange-600 py-2">Connect wallet to interact</p>
                    ) : mySquadInfo?.squadId ? (
                      <button 
                        disabled 
                        className="w-full py-2 px-4 bg-gray-300 text-gray-600 font-semibold rounded-lg cursor-not-allowed">
                        Already in a Squad
                      </button>
                    ) : isSquadFull ? (
                       <button 
                        disabled 
                        className="w-full py-2 px-4 bg-red-200 text-red-600 font-semibold rounded-lg cursor-not-allowed">
                        Squad Full
                      </button>
                    ) : hasPendingRequestForThisSquad ? (
                      <button 
                        disabled 
                        className="w-full py-2 px-4 bg-yellow-200 text-yellow-700 font-semibold rounded-lg cursor-not-allowed">
                        Request Pending
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleOpenRequestModal(squad)}
                        className="w-full py-2 px-4 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg shadow hover:shadow-md transition-colors"
                      >
                        Request to Join
                      </button>
                    )}
                    <Link href={`/squads/${squad.squadId}`} passHref>
                       <button className="w-full py-2 px-4 border border-sky-500 text-sky-600 hover:bg-sky-100 text-sm font-semibold rounded-lg transition-colors">
                          View Details
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {selectedSquadForRequest && (
        <RequestToJoinModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          squadName={selectedSquadForRequest.name}
          squadId={selectedSquadForRequest.squadId}
          onSubmit={handleSubmitJoinRequest}
          isSubmitting={isSubmittingRequest}
        />
      )}
    </main>
  );
} 