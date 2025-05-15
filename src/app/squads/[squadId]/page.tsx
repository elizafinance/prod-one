"use client";

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { SquadDocument, SquadInvitationDocument, ISquadJoinRequest } from '@/lib/mongodb'; // Added ISquadJoinRequest
import UserAvatar from "@/components/UserAvatar";
import { QuestProgressData, useSquadQuestProgressStore } from '@/store/useQuestProgressStore'; // Adjust path
// import CommunityQuest from '@/models/communityQuest.model'; // This is the Mongoose model
import RequestToJoinModal from '@/components/modals/RequestToJoinModal';

// Updated interface to match the enriched data from the new API
interface EnrichedSquadMember {
  walletAddress: string;
  xUsername?: string;
  xProfileImageUrl?: string;
  points?: number;
}
interface SquadDetailsData extends SquadDocument {
  membersFullDetails?: EnrichedSquadMember[]; // Changed back to optional since API might not always provide it
  leaderReferralCode?: string; // Add field for leader's referral code
  totalSquadPoints: number; // Added to match the API response
  maxMembers?: number; // Added maxMembers field
}

// Define a Quest type for frontend usage based on expected fields from CommunityQuest model
interface Quest {
  _id: string; // Assuming _id is string on frontend after serialization
  title: string;
  description: string;
  goal_target: number;
  goal_target_metadata?: {
    tier_name?: string;
    currency?: string;
  };
  // Add other fields from CommunityQuest that are needed by the UI
}

// Example: Placeholder for a Quest Card component
const QuestCard = ({ quest, progress }: { quest: Quest, progress?: QuestProgressData }) => {
    const displayProgress = progress?.currentProgress || 0;
    const displayGoal = progress?.goalTarget || quest.goal_target;
    const percentage = displayGoal > 0 ? (displayProgress / displayGoal) * 100 : 0;

    return (
        <div style={{ border: '1px solid #ccc', margin: '10px', padding: '10px' }}>
            <h4>{quest.title} (Squad Quest)</h4>
            <p>{quest.description}</p>
            <p>Goal: {displayGoal} {quest.goal_target_metadata?.currency || ''}</p>
            <p>Progress: {displayProgress}</p>
            <div style={{ width: '100%', backgroundColor: '#eee' }}>
                <div style={{ width: `${percentage}%`, backgroundColor: 'green', height: '20px' }}>
                    {Math.round(percentage)}%
                </div>
            </div>
            {progress?.updatedAt && <p><small>Last update: {new Date(progress.updatedAt).toLocaleTimeString()}</small></p>}
        </div>
    );
};

interface SquadDetailPageParams {
    squadId: string;
}

export default function SquadDetailPage({ params }: { params: SquadDetailPageParams | null }) { // Allow params to be null
    const squadId = params?.squadId; // Safely access squadId
    
    const [activeSquadQuests, setActiveSquadQuests] = useState<Quest[]>([]); 
    const [isLoadingQuests, setIsLoadingQuests] = useState(true);

    const squadProgressMap = useSquadQuestProgressStore((state) => 
        squadId ? state.squadQuestProgress[squadId] || {} : {}
    );

    useEffect(() => {
        const fetchActiveSquadQuests = async () => {
            if (!squadId) return;
            setIsLoadingQuests(true);
            try {
                const response = await fetch(`/api/quests?scope=squad&status=active`);
                if (!response.ok) throw new Error('Failed to fetch squad quests');
                const questsData = await response.json();
                setActiveSquadQuests(questsData.quests || questsData || []); 
            } catch (err) {
                console.error("Error fetching squad quests:", err);
            }
            setIsLoadingQuests(false);
        };

        fetchActiveSquadQuests();
    }, [squadId]);
    
    if (!squadId) {
        // This case should ideally be handled by Next.js routing if squadId is a required param
        // or show a specific component e.g. <SquadNotFound /> or <LoadingSquad />
        return <p>Loading squad information or Squad ID not found...</p>; 
    }
export default function SquadDetailsPage() {
  const params = useParams();
  const router = useRouter();
  // Ensure squadId is a string, handle cases where it might not be.
  const squadId = typeof params?.squadId === 'string' ? params.squadId : null;
  const { publicKey, connected } = useWallet();
  const currentUserWalletAddress = publicKey?.toBase58();

  const [squadDetails, setSquadDetails] = useState<SquadDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  // State for editing squad info
  const [isEditingSquad, setIsEditingSquad] = useState(false);
  const [editableSquadName, setEditableSquadName] = useState('');
  const [editableDescription, setEditableDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [isKickingMember, setIsKickingMember] = useState<string | null>(null); // Store walletAddress of member being kicked
  const [inviteType, setInviteType] = useState<'wallet' | 'twitter'>('wallet');
  const [inviteeWalletAddress, setInviteeWalletAddress] = useState('');
  const [inviteeTwitterHandle, setInviteeTwitterHandle] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isSearchingTwitterUser, setIsSearchingTwitterUser] = useState(false);
  const [foundTwitterUser, setFoundTwitterUser] = useState<{ walletAddress: string, xUsername: string, xProfileImageUrl?: string } | null>(null);

  const [sentPendingInvites, setSentPendingInvites] = useState<SquadInvitationDocument[]>([]);
  const [isFetchingSentInvites, setIsFetchingSentInvites] = useState(false);
  const [isRevokingInvite, setIsRevokingInvite] = useState<string | null>(null); // invitationId being revoked

  // State for managing join requests (for leader)
  const [joinRequests, setJoinRequests] = useState<ISquadJoinRequest[]>([]);
  const [isFetchingJoinRequests, setIsFetchingJoinRequests] = useState(false);
  const [isProcessingJoinRequest, setIsProcessingJoinRequest] = useState<string | null>(null); // requestId being processed

  // State for requesting to join (viewer who is not a member)
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isSubmittingJoinRequest, setIsSubmittingJoinRequest] = useState(false);
  const [hasPendingRequestForThisSquad, setHasPendingRequestForThisSquad] = useState(false);

  // Determine membership & leadership status
  const isUserMember = squadDetails?.memberWalletAddresses.includes(currentUserWalletAddress || '');
  const isUserLeader = squadDetails?.leaderWalletAddress === currentUserWalletAddress;

  // Forward declaration for fetchSentPendingInvitesForSquad
  const fetchSentPendingInvitesForSquad = useCallback(async (currentSquadId: string) => {
    if (!currentSquadId || !connected) return;
    
    setIsFetchingSentInvites(true);
    try {
      const response = await fetch('/api/squads/invitations/sent'); 
      if (response.ok) {
        const data = await response.json();
        const squadSpecificInvites = (data.invitations || []).filter((inv: SquadInvitationDocument) => inv.squadId === currentSquadId && inv.status === 'pending');
        setSentPendingInvites(squadSpecificInvites);
      } else {
        toast.error("Could not fetch sent invitations for this squad.");
        setSentPendingInvites([]);
      }
    } catch (err) {
      toast.error("Error fetching sent invitations.");
      console.error("Fetch sent invites error:", err);
      setSentPendingInvites([]);
    }
    setIsFetchingSentInvites(false);
  }, [connected]);

  // Forward declaration for fetchJoinRequestsForSquad
  const fetchJoinRequestsForSquad = useCallback(async (currentSquadId: string) => {
    if (!currentSquadId || !connected) return;
    setIsFetchingJoinRequests(true);
    try {
      const response = await fetch(`/api/squads/${currentSquadId}/join-requests`);
      if (response.ok) {
        const data = await response.json();
        setJoinRequests(data.requests || []);
      } else {
        toast.error("Failed to fetch join requests for your squad.");
        setJoinRequests([]);
      }
    } catch (err) {
      toast.error("Error fetching join requests.");
      console.error("Fetch join requests error:", err);
      setJoinRequests([]);
    }
    setIsFetchingJoinRequests(false);
  }, [connected]);

  useEffect(() => {
    if (squadId === null) {
      toast.error("Invalid Squad ID.");
      router.push("/squads/browse");
    }
  }, [squadId, router]);

  const fetchSquadDetails = useCallback(async () => {
    if (!squadId || !connected) return;
    
    setIsLoading(true);
    setError(null);
    console.log(`[SquadDetailsPage] Fetching details for squadId: ${squadId}`);
    try {
      const response = await fetch(`/api/squads/details/${squadId}`); 
      const data = await response.json();

      if (response.ok && data.squad) {
        console.log("[SquadDetailsPage] Squad details received:", data.squad);
        setSquadDetails(data.squad as SquadDetailsData);
        setEditableSquadName(data.squad.name || '');
        setEditableDescription(data.squad.description || '');
        setHasLoadedInitialData(true);
        
        if (data.squad.leaderWalletAddress === currentUserWalletAddress) {
          fetchSentPendingInvitesForSquad(data.squad.squadId);
          fetchJoinRequestsForSquad(data.squad.squadId);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch squad details. Squad may not exist or an error occurred.');
      }
    } catch (err) {
      console.error("[SquadDetailsPage] Error fetching squad details:", err);
      setError((err as Error).message || 'Could not load squad details.');
      setHasLoadedInitialData(true);
    }
    setIsLoading(false);
  }, [squadId, connected, currentUserWalletAddress, fetchSentPendingInvitesForSquad, fetchJoinRequestsForSquad]);

  useEffect(() => {
    // Only fetch once when page loads or squadId/connection changes
    if (!hasLoadedInitialData) {
      fetchSquadDetails();
    }
  }, [fetchSquadDetails, hasLoadedInitialData]);

  // Reset loading state when wallet or squad ID changes
  useEffect(() => {
    setHasLoadedInitialData(false);
  }, [squadId, publicKey]);

  // Fetch current user's pending join requests to check for this squad
  useEffect(() => {
    const fetchMyPendingRequests = async () => {
      if (!connected || !publicKey || !squadId || isUserMember) {
        setHasPendingRequestForThisSquad(false);
        return;
      }

      try {
        const response = await fetch('/api/squads/join-requests/my-pending');
        if (response.ok) {
          const data = await response.json();
          const hasPending = (data.requests || []).some((req: ISquadJoinRequest) => req.squadId === squadId && req.status === 'pending');
          setHasPendingRequestForThisSquad(hasPending);
        } else {
          console.error('Failed to fetch pending join requests for user');
          setHasPendingRequestForThisSquad(false);
        }
      } catch (err) {
        console.error('Error fetching my pending join requests:', err);
        setHasPendingRequestForThisSquad(false);
      }
    };

    fetchMyPendingRequests();
  }, [connected, publicKey, squadId, isUserMember]);

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
  
  const handleEditSquadSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!squadDetails) return;
    setIsSavingEdit(true);
    try {
      const payload: { squadName?: string; description?: string } = {};
      if (editableSquadName !== squadDetails.name) payload.squadName = editableSquadName;
      if (editableDescription !== squadDetails.description) payload.description = editableDescription;

      if (Object.keys(payload).length === 0) {
        toast.info("No changes made.");
        setIsEditingSquad(false);
        setIsSavingEdit(false);
        return;
      }

      const response = await fetch(`/api/squads/edit/${squadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Squad updated successfully!");
        if (data.squad) setSquadDetails(data.squad as SquadDetailsData); // Update local state with new squad data
        setIsEditingSquad(false);
      } else {
        toast.error(data.error || "Failed to update squad.");
      }
    } catch (err) {
      toast.error("An error occurred while updating squad.");
      console.error("Edit squad error:", err);
    }
    setIsSavingEdit(false);
  };

  const handleKickMember = async (memberWalletAddressToKick: string) => {
    if (!squadDetails || !isUserLeader) {
      toast.error("Only leaders can kick members.");
      return;
    }
    if (memberWalletAddressToKick === currentUserWalletAddress) {
      toast.error("Leader cannot kick themselves.");
      return;
    }

    if (!window.confirm(`Are you sure you want to kick this member (${memberWalletAddressToKick.substring(0,6)}...)? This action cannot be undone.`)) {
      return;
    }

    setIsKickingMember(memberWalletAddressToKick);
    try {
      const response = await fetch(`/api/squads/kick/${squadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberWalletAddressToKick }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Member kicked successfully.");
        fetchSquadDetails(); // Refresh squad details to update member list and count
      } else {
        toast.error(data.error || "Failed to kick member.");
      }
    } catch (err) {
      toast.error("An error occurred while kicking member.");
      console.error("Kick member error:", err);
    }
    setIsKickingMember(null);
  };

  const handleTransferLeadership = async (newLeaderWalletAddress: string) => {
    if (!squadDetails || !isUserLeader) {
      toast.error("Only leaders can transfer leadership.");
      return;
    }
    if (newLeaderWalletAddress === currentUserWalletAddress) {
      toast.error("Cannot transfer leadership to yourself.");
      return;
    }

    const newLeaderUsername = squadDetails.membersFullDetails?.find(m => m.walletAddress === newLeaderWalletAddress)?.xUsername || newLeaderWalletAddress.substring(0,6);
    if (!window.confirm(`Are you sure you want to make @${newLeaderUsername} the new leader? This action cannot be undone.`)) {
      return;
    }

    // We can reuse isKickingMember state for loading, or create a new one like isTransferring
    setIsKickingMember(newLeaderWalletAddress); // Re-using state to show loading on the button
    try {
      const response = await fetch(`/api/squads/transfer-leader/${squadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newLeaderWalletAddress }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Leadership transferred successfully!");
        fetchSquadDetails(); // Refresh squad details to update leader status and remove buttons
      } else {
        toast.error(data.error || "Failed to transfer leadership.");
      }
    } catch (err) {
      toast.error("An error occurred while transferring leadership.");
      console.error("Transfer leadership error:", err);
    }
    setIsKickingMember(null); // Reset loading state
  };

  const searchUserByTwitterHandle = async () => {
    if (!inviteeTwitterHandle.trim()) {
      toast.error("Please enter a Twitter handle to search.");
      return;
    }
    
    setIsSearchingTwitterUser(true);
    setFoundTwitterUser(null);
    
    try {
      const handle = inviteeTwitterHandle.trim();
      const response = await fetch(`/api/users/by-twitter-handle?handle=${encodeURIComponent(handle)}`);
      const data = await response.json();
      
      if (response.ok && data) {
        setFoundTwitterUser(data);
        toast.success(`Found user: @${data.xUsername}`);
      } else {
        toast.error(data.error || "User not found.");
      }
    } catch (err) {
      toast.error("An error occurred while searching for the user.");
      console.error("Twitter user search error:", err);
    }
    
    setIsSearchingTwitterUser(false);
  };

  const handleSendInvite = async () => {
    if (!squadDetails) {
      toast.error("Squad details not available.");
      return;
    }
    
    // Check if we have a valid input based on the selected invite type
    if (inviteType === 'wallet' && !inviteeWalletAddress.trim()) {
      toast.error("Please enter a wallet address to invite.");
      return;
    }
    
    if (inviteType === 'twitter') {
      if (!foundTwitterUser) {
        if (!inviteeTwitterHandle.trim()) {
          toast.error("Please enter a Twitter handle to invite.");
        } else {
          toast.error("Please search for the Twitter user first.");
        }
        return;
      }
    }
    
    setIsSendingInvite(true);
    try {
      // Prepare request body based on invite type
      const requestBody = {
        squadId: squadDetails.squadId,
        ...(inviteType === 'wallet' 
          ? { targetUserWalletAddress: inviteeWalletAddress.trim() }
          : { targetTwitterHandle: inviteeTwitterHandle.trim() })
      };
      
      const response = await fetch('/api/squads/invitations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Invitation sent successfully!");
        // Reset form
        setInviteeWalletAddress('');
        setInviteeTwitterHandle('');
        setFoundTwitterUser(null);
        // Refresh sent invites for leader
        if (isUserLeader) fetchSentPendingInvitesForSquad(squadDetails.squadId);
      } else {
        toast.error(data.error || "Failed to send invitation.");
      }
    } catch (err) {
      toast.error("An error occurred while sending invitation.");
      console.error("Send invite error:", err);
    }
    setIsSendingInvite(false);
  };

  const handleRevokeInvite = async (invitationIdToRevoke: string) => {
    setIsRevokingInvite(invitationIdToRevoke);
    try {
      const response = await fetch('/api/squads/invitations/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: invitationIdToRevoke }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Invitation revoked successfully!");
        // Refresh the list of sent pending invites for this squad
        if (squadDetails) fetchSentPendingInvitesForSquad(squadDetails.squadId);
      } else {
        toast.error(data.error || "Failed to revoke invitation.");
      }
    } catch (err) {
      toast.error("An error occurred while revoking invitation.");
      console.error("Revoke invite error:", err);
    }
    setIsRevokingInvite(null);
  };

  const handleCopyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.success("Referral link copied to clipboard!");
    }).catch(err => {
      toast.error("Failed to copy link.");
    });
  };

  const handleProcessJoinRequest = async (requestId: string, action: 'approve' | 'reject') => {
    setIsProcessingJoinRequest(requestId);
    try {
      const response = await fetch(`/api/squads/join-requests/${requestId}/${action}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || `Request ${action}d successfully!`);
        setJoinRequests(prev => prev.filter(req => req.requestId !== requestId));
        if (action === 'approve') {
          fetchSquadDetails(); // Re-fetch squad details to update member list
        }
      } else {
        toast.error(data.error || `Failed to ${action} request.`);
      }
    } catch (err) {
      toast.error(`An error occurred while ${action}ing request.`);
      console.error(`Error ${action}ing request:`, err);
    }
    setIsProcessingJoinRequest(null);
  };

  // Handler to open request modal
  const handleOpenRequestModal = () => {
    if (!connected || !publicKey) {
      toast.error('Connect your wallet to send a join request.');
      return;
    }
    setIsRequestModalOpen(true);
  };

  const handleSubmitJoinRequest = async (targetSquadId: string, message?: string) => {
    setIsSubmittingJoinRequest(true);
    try {
      const response = await fetch(`/api/squads/${targetSquadId}/request-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || 'Join request sent!');
        setHasPendingRequestForThisSquad(true);
        setIsRequestModalOpen(false);
      } else {
        toast.error(data.error || 'Failed to send join request.');
      }
    } catch (err) {
      toast.error('An unexpected error occurred while sending request.');
      console.error('Submit join request error:', err);
    }
    setIsSubmittingJoinRequest(false);
  };

  if (isLoading) return <main className="flex items-center justify-center min-h-screen bg-white text-gray-700"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div><p className='ml-3 text-lg'>Loading Squad Details...</p></main>;
  if (error) return <main className="flex flex-col items-center justify-center min-h-screen bg-white text-red-700"><p className="text-xl mb-4">Error: {error}</p><Link href="/squads/browse"><button className='p-2 bg-blue-500 hover:bg-blue-600 rounded text-white'>Back to Browse Squads</button></Link></main>;
  if (!squadDetails) return <main className="flex flex-col items-center justify-center min-h-screen bg-white text-gray-700"><p className="text-xl mb-4">Squad not found.</p><Link href="/squads/browse"><button className='p-2 bg-blue-500 hover:bg-blue-600 rounded text-white'>Back to Browse Squads</button></Link></main>;

    return (
        <div>
            <h3>Active Squad Quests for Squad: {squadId}</h3>
            {isLoadingQuests && <p>Loading quests...</p>}
            {!isLoadingQuests && activeSquadQuests.length === 0 && <p>No active squad quests currently.</p>}
            {activeSquadQuests.map(quest => (
                <QuestCard key={quest._id} quest={quest} progress={squadProgressMap[quest._id]} />
            ))}
  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-white text-gray-900">
      <div className="w-full max-w-3xl mx-auto my-10 bg-white border border-gray-200 shadow-xl rounded-xl p-6 sm:p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            {!isEditingSquad ? (
              <h1 className="text-4xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-600 to-red-600">
                {squadDetails?.name}
              </h1>
            ) : (
              <h1 className="text-4xl font-bold font-spacegrotesk tracking-tight text-gray-800">
                Edit Squad Info
              </h1>
            )}
            {!isEditingSquad && squadDetails?.description && <p className="text-gray-600 mt-1 text-sm">{squadDetails.description}</p>}
          </div>
          <div className="flex flex-col space-y-2 items-end flex-shrink-0 ml-4">
            <Link href="/squads/browse" passHref>
              <button className="bg-gray-500 hover:bg-gray-600 text-white text-xs font-semibold py-1.5 px-3 rounded-md shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out w-full sm:w-auto">
                  Browse Squads
              </button>
            </Link>
            {isUserLeader && !isEditingSquad && (
              <button 
                onClick={() => {
                  setEditableSquadName(squadDetails?.name || '');
                  setEditableDescription(squadDetails?.description || '');
                  setIsEditingSquad(true);
                }}
                className="bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-semibold py-1.5 px-3 rounded-md shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out w-full sm:w-auto"
              >
                Edit Info
              </button>
            )}
          </div>
        </div>

        {isEditingSquad && (
          <form onSubmit={handleEditSquadSubmit} className="mb-6 p-6 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
            <div>
              <label htmlFor="editableSquadName" className="block text-sm font-medium text-gray-700 mb-1">Squad Name</label>
              <input type="text" id="editableSquadName" value={editableSquadName} onChange={(e) => setEditableSquadName(e.target.value)} 
                     className="w-full p-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-blue-500 focus:border-blue-500" maxLength={30} />
            </div>
            <div>
              <label htmlFor="editableDescription" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea id="editableDescription" value={editableDescription} onChange={(e) => setEditableDescription(e.target.value)} 
                        rows={3} className="w-full p-2 bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-blue-500 focus:border-blue-500" maxLength={150} />
            </div>
            <div className="flex justify-end space-x-3">
              <button type="button" onClick={() => setIsEditingSquad(false)} disabled={isSavingEdit}
                      className="py-2 px-4 bg-gray-400 hover:bg-gray-500 text-white font-semibold rounded-md disabled:opacity-50">
                Cancel
              </button>
              <button type="submit" disabled={isSavingEdit}
                      className="py-2 px-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md disabled:opacity-50">
                {isSavingEdit ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h2 className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-1">Leader</h2>
            <p className="text-gray-700 font-mono text-sm truncate" title={squadDetails.leaderWalletAddress}>{squadDetails.leaderWalletAddress.substring(0,10)}...</p>
          </div>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h2 className="text-xs font-semibold text-purple-700 uppercase tracking-wider mb-1">Total Points</h2>
            <p className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-red-600">
              {squadDetails.totalSquadPoints.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">Members ({squadDetails.membersFullDetails?.length || squadDetails.memberWalletAddresses.length} / {squadDetails.maxMembers || process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || 100})</h2>
          <ul className="space-y-2 max-h-72 overflow-y-auto bg-gray-50 border border-gray-200 p-3 rounded-lg">
            {squadDetails.membersFullDetails && squadDetails.membersFullDetails.length > 0 ? (
              squadDetails.membersFullDetails.map(member => (
                <li key={member.walletAddress} className="p-3 bg-white border border-gray-200 rounded text-sm text-gray-700 flex justify-between items-center hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <UserAvatar 
                      profileImageUrl={member.xProfileImageUrl}
                      username={member.xUsername}
                      size="sm"
                    />
                    <div>
                      <span className="font-mono block text-gray-800">{member.xUsername ? `@${member.xUsername}` : `${member.walletAddress.substring(0,8)}...${member.walletAddress.substring(member.walletAddress.length - 4)}`}</span>
                      <span className="text-xs text-purple-700">Points: {member.points?.toLocaleString() || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {member.walletAddress === currentUserWalletAddress && <span className="text-xs px-2 py-1 bg-purple-500 text-white rounded-full">You</span>}
                    {member.walletAddress === squadDetails.leaderWalletAddress && <span className="text-xs px-2 py-1 bg-yellow-400 text-black rounded-full">Leader</span>}
                    {isUserLeader && member.walletAddress !== currentUserWalletAddress && (
                      <>
                        <button 
                          onClick={() => handleTransferLeadership(member.walletAddress)}
                          disabled={isKickingMember === member.walletAddress}
                          className="px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:opacity-50 whitespace-nowrap"
                          title="Transfer leadership to this member"
                        >
                          {isKickingMember === member.walletAddress ? 'Transferring...' : 'Make Leader'}
                        </button>
                      <button 
                        onClick={() => handleKickMember(member.walletAddress)}
                        disabled={isKickingMember === member.walletAddress}
                          className="px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md disabled:opacity-50"
                      >
                        {isKickingMember === member.walletAddress ? 'Kicking...' : 'Kick'}
                      </button>
                      </>
                    )}
                  </div>
                </li>
              ))
            ) : (
              <li className="p-2 text-sm text-gray-500">No member details available or squad is empty.</li>
            )}
          </ul>
        </div>

        <div className="mt-8 border-t border-gray-300 pt-6">
          {connected && isUserMember && !isUserLeader && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Squad Actions</h3>
              <button 
                onClick={handleLeaveSquad}
                disabled={isLeaving}
                className="w-full py-2.5 px-5 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out"
              >
                {isLeaving ? 'Leaving Squad...' : 'Leave Squad'}
              </button>
            </div>
          )}

          {isUserLeader && squadDetails && (
            <div>
              <h3 className="text-xl font-bold text-yellow-600 mb-4 text-center">Leader Tools</h3>
              
              {/* Join Requests Management - NEW SECTION */}
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
                <h4 className="text-md font-semibold text-yellow-800 mb-3">Pending Join Requests ({joinRequests.length})</h4>
                {isFetchingJoinRequests && <p className="text-sm text-yellow-700">Loading join requests...</p>}
                {!isFetchingJoinRequests && joinRequests.length === 0 && <p className="text-sm text-yellow-700">No pending join requests.</p>}
                {!isFetchingJoinRequests && joinRequests.length > 0 && (
                  <ul className="space-y-3 max-h-72 overflow-y-auto">
                    {joinRequests.map(req => (
                      <li key={req.requestId} className="p-3 bg-white border border-gray-200 rounded-md shadow-sm">
                        <div className="flex items-start gap-3">
                          <UserAvatar 
                            profileImageUrl={req.requestingUserXProfileImageUrl}
                            username={req.requestingUserXUsername}
                            size="sm"
                          />
                          <div className="flex-grow">
                            <p className="text-sm font-semibold text-gray-800">
                              {req.requestingUserXUsername ? `@${req.requestingUserXUsername}` : `${req.requestingUserWalletAddress.substring(0,6)}...`}
                            </p>
                            <p className="text-xs text-gray-500 font-mono" title={req.requestingUserWalletAddress}>{req.requestingUserWalletAddress}</p>
                            {req.message && <p className="text-xs text-gray-600 mt-1 italic bg-gray-100 p-1.5 rounded">{req.message}</p>}
                          </div>
                        </div>
                        <div className="mt-3 flex space-x-2 justify-end">
                          <button 
                            onClick={() => handleProcessJoinRequest(req.requestId, 'reject')}
                            disabled={isProcessingJoinRequest === req.requestId}
                            className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md disabled:opacity-60"
                          >
                            {isProcessingJoinRequest === req.requestId ? 'Rejecting...' : 'Reject'}
                          </button>
                          <button 
                            onClick={() => handleProcessJoinRequest(req.requestId, 'approve')}
                            disabled={isProcessingJoinRequest === req.requestId}
                            className="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded-md disabled:opacity-60"
                          >
                            {isProcessingJoinRequest === req.requestId ? 'Approving...' : 'Approve'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-2">Invite New Member:</h4>
                <div className="flex mb-4 bg-gray-200 rounded-lg p-1 w-fit">
                  <button 
                    onClick={() => setInviteType('wallet')}
                    className={`px-3 py-1.5 text-sm font-medium rounded ${
                      inviteType === 'wallet' 
                        ? 'bg-sky-500 text-white' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    By Wallet
                  </button>
                  <button 
                    onClick={() => {
                      setInviteType('twitter');
                      setFoundTwitterUser(null);
                    }}
                    className={`px-3 py-1.5 text-sm font-medium rounded ${
                      inviteType === 'twitter' 
                        ? 'bg-sky-500 text-white' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    By Twitter
                  </button>
                </div>
                
                {inviteType === 'wallet' ? (
                  <div className="space-y-2">
                    <label htmlFor="inviteeWallet" className="block text-sm font-medium text-gray-700">
                      Wallet Address to Invite:
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        id="inviteeWallet" 
                        value={inviteeWalletAddress} 
                        onChange={(e) => setInviteeWalletAddress(e.target.value)} 
                        className="flex-grow p-2 bg-white border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter wallet address"
                      />
                      <button 
                        onClick={handleSendInvite}
                        disabled={isSendingInvite || !inviteeWalletAddress.trim()}
                        className="py-2 px-4 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-md shadow disabled:opacity-70"
                      >
                        {isSendingInvite ? 'Sending...' : 'Send Invite'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="inviteeTwitter" className="block text-sm font-medium text-gray-700">
                        Twitter Handle to Invite:
                      </label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          id="inviteeTwitter" 
                          value={inviteeTwitterHandle} 
                          onChange={(e) => setInviteeTwitterHandle(e.target.value)} 
                          className="flex-grow p-2 bg-white border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter Twitter handle (with or without @)"
                        />
                        <button 
                          onClick={searchUserByTwitterHandle}
                          disabled={isSearchingTwitterUser || !inviteeTwitterHandle.trim()}
                          className="py-2 px-4 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-md shadow disabled:opacity-70"
                        >
                          {isSearchingTwitterUser ? 'Searching...' : 'Search'}
                        </button>
                      </div>
                    </div>
                    
                    {foundTwitterUser && (
                      <div className="p-3 bg-gray-200 rounded-lg flex items-center gap-3">
                        <UserAvatar 
                          profileImageUrl={foundTwitterUser.xProfileImageUrl} 
                          username={foundTwitterUser.xUsername}
                          size="md"
                        />
                        <div className="flex-grow">
                          <p className="text-gray-900 font-medium">@{foundTwitterUser.xUsername}</p>
                          <p className="text-xs text-gray-500">{foundTwitterUser.walletAddress.substring(0, 6)}...{foundTwitterUser.walletAddress.substring(foundTwitterUser.walletAddress.length - 4)}</p>
                        </div>
                        <button 
                          onClick={handleSendInvite}
                          disabled={isSendingInvite}
                          className="py-1.5 px-3 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-md text-sm shadow disabled:opacity-70"
                        >
                          {isSendingInvite ? 'Sending...' : 'Send Invite'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-6">
                <h4 className="text-md font-semibold text-gray-800 mb-2">Pending Invites Sent:</h4>
                {isFetchingSentInvites && <p className="text-sm text-gray-500">Loading sent invites...</p>}
                {!isFetchingSentInvites && sentPendingInvites.length === 0 && <p className="text-sm text-gray-500">No pending invites sent from this squad.</p>}
                {!isFetchingSentInvites && sentPendingInvites.length > 0 && (
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {sentPendingInvites.map(invite => (
                      <li key={invite.invitationId} className="p-2 bg-gray-200 rounded-md text-sm flex justify-between items-center">
                        <div>
                          <span className="text-gray-700">To: {invite.invitedUserWalletAddress.substring(0,6)}...{invite.invitedUserWalletAddress.substring(invite.invitedUserWalletAddress.length - 4)}</span>
                          <span className="block text-xs text-gray-500">Sent: {new Date(invite.createdAt || Date.now()).toLocaleDateString()}</span>
                        </div>
                        <button 
                          onClick={() => handleRevokeInvite(invite.invitationId)}
                          disabled={isRevokingInvite === invite.invitationId}
                          className="px-2 py-1 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-md disabled:opacity-50"
                        >
                          {isRevokingInvite === invite.invitationId ? 'Revoking...' : 'Revoke'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Leader Referral Link Section */}
              {squadDetails.leaderReferralCode && squadDetails.squadId && (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg mb-6">
                  <h4 className="text-md font-semibold text-gray-800 mb-2">Squad Invite & Referral Link:</h4>
                  <p className="text-xs text-gray-600 mb-2">
                    Share this link! New users clicking this will be credited to your referral count AND automatically invited to this squad after activating.
                  </p>
                  <div className="flex items-center justify-center bg-gray-200 p-2 rounded">
                    <input 
                      type="text" 
                      readOnly 
                      value={`https://squad.defairewards.net/?ref=${squadDetails.leaderReferralCode}&squadInvite=${squadDetails.squadId}`}
                      className="text-gray-700 text-sm break-all bg-transparent outline-none flex-grow p-1"
                    />
                    <button 
                      onClick={() => handleCopyToClipboard(`https://squad.defairewards.net/?ref=${squadDetails.leaderReferralCode}&squadInvite=${squadDetails.squadId}`)}
                      className="ml-2 py-1 px-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-300/50">
                 <h4 className="text-md font-semibold text-red-500 mb-2">Disband Squad (As Leader):</h4>
                 <p className="text-xs text-gray-500 mb-2">If you leave as the leader, the next member in line will be promoted. If you are the last member, the squad will be disbanded.</p>
                <button 
                    onClick={handleLeaveSquad}
                    disabled={isLeaving}
                    className="w-full py-2.5 px-5 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out"
                    >
                    {isLeaving ? 'Leaving & Disbanding...' : 'Leave & Disband Squad'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center">Kick members directly from the member list above.</p>
            </div>
          )}
        </div>
    );

        {/* 'Request to Join' button for non-members */}
        {connected && !isUserMember && squadDetails && (
          <div className="mt-8 border-t border-gray-300 pt-6 text-center">
            {hasPendingRequestForThisSquad ? (
              <button 
                disabled
                className="py-2.5 px-6 bg-yellow-200 text-yellow-700 font-semibold rounded-lg cursor-not-allowed"
              >
                Request Pending
              </button>
            ) : (
              <button 
                onClick={handleOpenRequestModal}
                className="py-2.5 px-6 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out"
              >
                Request to Join Squad
              </button>
            )}
          </div>
        )}
      </div>

      {/* Request To Join Modal */}
      {squadDetails && (
        <RequestToJoinModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          squadName={squadDetails.name}
          squadId={squadDetails.squadId}
          onSubmit={handleSubmitJoinRequest}
          isSubmitting={isSubmittingJoinRequest}
        />
      )}
    </main>
  );
} 