"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { SquadDocument } from '@/lib/mongodb'; // UserDocument no longer explicitly needed here

// Updated interface to match the enriched data from the new API
interface EnrichedSquadMember {
  walletAddress: string;
  xUsername?: string;
  points?: number;
}
interface SquadDetailsData extends SquadDocument {
  membersFullDetails: EnrichedSquadMember[]; // Changed from optional to required as API now provides it
}

export default function SquadDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const squadId = params.squadId as string;
  const { publicKey, connected } = useWallet();
  const currentUserWalletAddress = publicKey?.toBase58();

  const [squadDetails, setSquadDetails] = useState<SquadDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSquadDetails = useCallback(async () => {
    if (!squadId) return;
    setIsLoading(true);
    setError(null);
    console.log(`[SquadDetailsPage] Fetching details for squadId: ${squadId}`);
    try {
      // Call the new dedicated API endpoint
      const response = await fetch(`/api/squads/details/${squadId}`); 
      const data = await response.json();

      if (response.ok && data.squad) {
        console.log("[SquadDetailsPage] Squad details received:", data.squad);
        setSquadDetails(data.squad as SquadDetailsData);
      } else {
        throw new Error(data.error || 'Failed to fetch squad details. Squad may not exist or an error occurred.');
      }
    } catch (err) {
      console.error("[SquadDetailsPage] Error fetching squad details:", err);
      setError((err as Error).message || 'Could not load squad details.');
    }
    setIsLoading(false);
  }, [squadId]); // Removed currentUserWalletAddress from deps as API doesn't need it directly for fetching

  useEffect(() => {
    fetchSquadDetails();
  }, [fetchSquadDetails]);

  const handleLeaveSquad = async () => {
    if (!connected || !squadDetails) {
      toast.error("Cannot leave squad. Ensure wallet is connected.");
      return;
    }
    setIsLeaving(true);
    try {
      const response = await fetch('/api/squads/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Successfully left squad.");
        router.push('/');
      } else {
        toast.error(data.error || "Failed to leave squad.");
      }
    } catch (err) {
      toast.error("An unexpected error occurred while leaving squad.");
      console.error("Leave squad error:", err);
    }
    setIsLeaving(false);
  };
  
  const isUserMember = squadDetails?.memberWalletAddresses.includes(currentUserWalletAddress || '');
  const isUserLeader = squadDetails?.leaderWalletAddress === currentUserWalletAddress;

  if (isLoading) return <main className="flex items-center justify-center min-h-screen bg-gray-900 text-white"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div><p className='ml-3 text-lg'>Loading Squad Details...</p></main>;
  if (error) return <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white"><p className="text-red-400 text-xl mb-4">Error: {error}</p><Link href="/squads/browse"><button className='p-2 bg-blue-500 hover:bg-blue-600 rounded text-white'>Back to Browse Squads</button></Link></main>;
  if (!squadDetails) return <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white"><p className="text-xl mb-4">Squad not found.</p><Link href="/squads/browse"><button className='p-2 bg-blue-500 hover:bg-blue-600 rounded text-white'>Back to Browse Squads</button></Link></main>;

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="w-full max-w-3xl mx-auto my-10 bg-white/10 backdrop-blur-md shadow-2xl rounded-xl p-6 sm:p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-4xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
              {squadDetails.name}
            </h1>
            {squadDetails.description && <p className="text-gray-300 mt-1 text-sm">{squadDetails.description}</p>}
          </div>
          <Link href="/squads/browse" passHref>
            <button className="bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out">
                Browse Squads
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="p-4 bg-white/5 rounded-lg">
            <h2 className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-1">Leader</h2>
            <p className="text-gray-200 font-mono text-sm truncate" title={squadDetails.leaderWalletAddress}>{squadDetails.leaderWalletAddress.substring(0,10)}...</p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg">
            <h2 className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-1">Total Points</h2>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-red-500">
              {squadDetails.totalSquadPoints.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-100 mb-3">Members ({squadDetails.membersFullDetails?.length || squadDetails.memberWalletAddresses.length} / {process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || 10})</h2>
          <ul className="space-y-2 max-h-72 overflow-y-auto bg-white/5 p-3 rounded-lg">
            {squadDetails.membersFullDetails && squadDetails.membersFullDetails.length > 0 ? (
              squadDetails.membersFullDetails.map(member => (
                <li key={member.walletAddress} className="p-3 bg-gray-700/60 rounded text-sm text-gray-300 flex justify-between items-center hover:bg-gray-600/60 transition-colors">
                  <div>
                    <span className="font-mono block">{member.xUsername ? `@${member.xUsername}` : `${member.walletAddress.substring(0,8)}...${member.walletAddress.substring(member.walletAddress.length - 4)}`}</span>
                    <span className="text-xs text-purple-300">Points: {member.points?.toLocaleString() || 'N/A'}</span>
                  </div>
                  <div>
                    {member.walletAddress === currentUserWalletAddress && <span className="text-xs px-2 py-1 bg-purple-500 text-white rounded-full">You</span>}
                    {member.walletAddress === squadDetails.leaderWalletAddress && <span className="text-xs ml-2 px-2 py-1 bg-yellow-500 text-black rounded-full">Leader</span>}
                  </div>
                </li>
              ))
            ) : (
                 <li className="p-2 text-sm text-gray-400">No member details available or squad is empty.</li>
            )}
          </ul>
        </div>

        {connected && isUserMember && (
          <div className="mt-6 border-t border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-red-400 mb-2">Squad Actions</h3>
            <button 
              onClick={handleLeaveSquad}
              disabled={isLeaving}
              className="w-full py-2.5 px-5 bg-red-600 hover:bg-red-700 disabled:bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out"
            >
              {isLeaving ? 'Leaving Squad...' : 'Leave Squad'}
            </button>
            {isUserLeader && (
                <p className="text-xs text-yellow-400 mt-3 text-center">Leader management features (e.g., edit squad, kick members) can be added here.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
} 