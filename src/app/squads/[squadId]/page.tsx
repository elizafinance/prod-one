"use client";

import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { SquadDocument, SquadInvitationDocument } from '@/lib/mongodb'; // Added SquadInvitationDocument
import UserAvatar from "@/components/UserAvatar";

// Updated interface to match the enriched data from the new API
interface EnrichedSquadMember {
  walletAddress: string;
  xUsername?: string;
  xProfileImageUrl?: string;
  points?: number;
}
interface SquadDetailsData extends SquadDocument {
  membersFullDetails?: EnrichedSquadMember[]; // Changed back to optional since API might not always provide it
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

  const fetchSquadDetails = useCallback(async () => {
    if (!squadId || !connected) return;
    
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
        setEditableSquadName(data.squad.name || ''); // Initialize edit form fields
        setEditableDescription(data.squad.description || '');
        setHasLoadedInitialData(true);
        
        // If current user is leader of this squad, fetch its pending sent invites
        if (data.squad.leaderWalletAddress === currentUserWalletAddress) {
          fetchSentPendingInvitesForSquad(data.squad.squadId);
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
  }, [squadId, connected, currentUserWalletAddress]);

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

  if (isLoading) return <main className="flex items-center justify-center min-h-screen bg-gray-900 text-white"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div><p className='ml-3 text-lg'>Loading Squad Details...</p></main>;
  if (error) return <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white"><p className="text-red-400 text-xl mb-4">Error: {error}</p><Link href="/squads/browse"><button className='p-2 bg-blue-500 hover:bg-blue-600 rounded text-white'>Back to Browse Squads</button></Link></main>;
  if (!squadDetails) return <main className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white"><p className="text-xl mb-4">Squad not found.</p><Link href="/squads/browse"><button className='p-2 bg-blue-500 hover:bg-blue-600 rounded text-white'>Back to Browse Squads</button></Link></main>;

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="w-full max-w-3xl mx-auto my-10 bg-white/10 backdrop-blur-md shadow-2xl rounded-xl p-6 sm:p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            {!isEditingSquad ? (
              <h1 className="text-4xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500">
                {squadDetails?.name}
              </h1>
            ) : (
              <h1 className="text-4xl font-bold font-spacegrotesk tracking-tight text-gray-300">
                Edit Squad Info
              </h1>
            )}
            {!isEditingSquad && squadDetails?.description && <p className="text-gray-300 mt-1 text-sm">{squadDetails.description}</p>}
          </div>
          <div className="flex flex-col space-y-2 items-end flex-shrink-0 ml-4">
            <Link href="/squads/browse" passHref>
              <button className="bg-gray-600 hover:bg-gray-700 text-white text-xs font-semibold py-1.5 px-3 rounded-md shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out w-full sm:w-auto">
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
                className="bg-yellow-500 hover:bg-yellow-600 text-black text-xs font-semibold py-1.5 px-3 rounded-md shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out w-full sm:w-auto"
              >
                Edit Info
              </button>
            )}
          </div>
        </div>

        {isEditingSquad && (
          <form onSubmit={handleEditSquadSubmit} className="mb-6 p-6 bg-black/20 rounded-lg space-y-4">
            <div>
              <label htmlFor="editableSquadName" className="block text-sm font-medium text-gray-200 mb-1">Squad Name</label>
              <input type="text" id="editableSquadName" value={editableSquadName} onChange={(e) => setEditableSquadName(e.target.value)} 
                     className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" maxLength={30} />
            </div>
            <div>
              <label htmlFor="editableDescription" className="block text-sm font-medium text-gray-200 mb-1">Description</label>
              <textarea id="editableDescription" value={editableDescription} onChange={(e) => setEditableDescription(e.target.value)} 
                        rows={3} className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white" maxLength={150} />
            </div>
            <div className="flex justify-end space-x-3">
              <button type="button" onClick={() => setIsEditingSquad(false)} disabled={isSavingEdit}
                      className="py-2 px-4 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-md disabled:opacity-50">
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
                  <div className="flex items-center gap-3">
                    <UserAvatar 
                      profileImageUrl={member.xProfileImageUrl}
                      username={member.xUsername}
                      size="sm"
                    />
                    <div>
                      <span className="font-mono block">{member.xUsername ? `@${member.xUsername}` : `${member.walletAddress.substring(0,8)}...${member.walletAddress.substring(member.walletAddress.length - 4)}`}</span>
                      <span className="text-xs text-purple-300">Points: {member.points?.toLocaleString() || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {member.walletAddress === currentUserWalletAddress && <span className="text-xs px-2 py-1 bg-purple-500 text-white rounded-full">You</span>}
                    {member.walletAddress === squadDetails.leaderWalletAddress && <span className="text-xs px-2 py-1 bg-yellow-500 text-black rounded-full">Leader</span>}
                    {isUserLeader && member.walletAddress !== currentUserWalletAddress && (
                      <button 
                        onClick={() => handleKickMember(member.walletAddress)}
                        disabled={isKickingMember === member.walletAddress}
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded-md disabled:opacity-50"
                      >
                        {isKickingMember === member.walletAddress ? 'Kicking...' : 'Kick'}
                      </button>
                    )}
                  </div>
                </li>
              ))
            ) : (
              <li className="p-2 text-sm text-gray-400">No member details available or squad is empty.</li>
            )}
          </ul>
        </div>

        <div className="mt-8 border-t border-gray-700 pt-6">
          {connected && isUserMember && !isUserLeader && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-100 mb-2">Squad Actions</h3>
              <button 
                onClick={handleLeaveSquad}
                disabled={isLeaving}
                className="w-full py-2.5 px-5 bg-red-600 hover:bg-red-700 disabled:bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out"
              >
                {isLeaving ? 'Leaving Squad...' : 'Leave Squad'}
              </button>
            </div>
          )}

          {isUserLeader && squadDetails && (
            <div>
              <h3 className="text-xl font-bold text-yellow-400 mb-4 text-center">Leader Tools</h3>
              
              <div className="p-4 bg-black/20 rounded-lg mb-6">
                <h4 className="text-md font-semibold text-gray-100 mb-2">Invite New Member:</h4>
                <div className="flex mb-4 bg-gray-800 rounded-lg p-1 w-fit">
                  <button 
                    onClick={() => setInviteType('wallet')}
                    className={`px-3 py-1.5 text-sm font-medium rounded ${
                      inviteType === 'wallet' 
                        ? 'bg-sky-500 text-white' 
                        : 'text-gray-300 hover:text-white'
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
                        : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    By Twitter
                  </button>
                </div>
                
                {inviteType === 'wallet' ? (
                  <div className="space-y-2">
                    <label htmlFor="inviteeWallet" className="block text-sm font-medium text-gray-200">
                      Wallet Address to Invite:
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        id="inviteeWallet" 
                        value={inviteeWalletAddress} 
                        onChange={(e) => setInviteeWalletAddress(e.target.value)} 
                        className="flex-grow p-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
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
                      <label htmlFor="inviteeTwitter" className="block text-sm font-medium text-gray-200">
                        Twitter Handle to Invite:
                      </label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          id="inviteeTwitter" 
                          value={inviteeTwitterHandle} 
                          onChange={(e) => setInviteeTwitterHandle(e.target.value)} 
                          className="flex-grow p-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
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
                      <div className="p-3 bg-gray-800 rounded-lg flex items-center gap-3">
                        <UserAvatar 
                          profileImageUrl={foundTwitterUser.xProfileImageUrl} 
                          username={foundTwitterUser.xUsername}
                          size="md"
                        />
                        <div className="flex-grow">
                          <p className="text-white font-medium">@{foundTwitterUser.xUsername}</p>
                          <p className="text-xs text-gray-400">{foundTwitterUser.walletAddress.substring(0, 6)}...{foundTwitterUser.walletAddress.substring(foundTwitterUser.walletAddress.length - 4)}</p>
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

              <div className="p-4 bg-black/20 rounded-lg mb-6">
                <h4 className="text-md font-semibold text-gray-100 mb-2">Pending Invites Sent:</h4>
                {isFetchingSentInvites && <p className="text-sm text-gray-400">Loading sent invites...</p>}
                {!isFetchingSentInvites && sentPendingInvites.length === 0 && <p className="text-sm text-gray-400">No pending invites sent from this squad.</p>}
                {!isFetchingSentInvites && sentPendingInvites.length > 0 && (
                  <ul className="space-y-2 max-h-48 overflow-y-auto">
                    {sentPendingInvites.map(invite => (
                      <li key={invite.invitationId} className="p-2 bg-gray-700/40 rounded-md text-sm flex justify-between items-center">
                        <div>
                          <span className="text-gray-300">To: {invite.invitedUserWalletAddress.substring(0,6)}...{invite.invitedUserWalletAddress.substring(invite.invitedUserWalletAddress.length - 4)}</span>
                          <span className="block text-xs text-gray-500">Sent: {new Date(invite.createdAt || Date.now()).toLocaleDateString()}</span>
                        </div>
                        <button 
                          onClick={() => handleRevokeInvite(invite.invitationId)}
                          disabled={isRevokingInvite === invite.invitationId}
                          className="px-2 py-1 text-xs bg-orange-600 hover:bg-orange-700 text-white rounded-md disabled:opacity-50"
                        >
                          {isRevokingInvite === invite.invitationId ? 'Revoking...' : 'Revoke'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700/50">
                 <h4 className="text-md font-semibold text-red-500 mb-2">Disband Squad (As Leader):</h4>
                 <p className="text-xs text-gray-400 mb-2">If you leave as the leader, the next member in line will be promoted. If you are the last member, the squad will be disbanded.</p>
                <button 
                    onClick={handleLeaveSquad}
                    disabled={isLeaving}
                    className="w-full py-2.5 px-5 bg-red-700 hover:bg-red-800 disabled:bg-gray-500 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out"
                    >
                    {isLeaving ? 'Leaving & Disbanding...' : 'Leave & Disband Squad'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-4 text-center">Kick members directly from the member list above.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 