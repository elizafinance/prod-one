"use client";

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { Users, Crown, MapPin, Trophy, TrendingUp, UserPlus, Settings, LogOut, Copy, MessageSquare, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SquadDocument, SquadInvitationDocument, ISquadJoinRequest } from '@/lib/mongodb';
import UserAvatar from "@/components/UserAvatar";
import { QuestProgressData, useSquadQuestProgressStore } from '@/store/useQuestProgressStore';
import RequestToJoinModal from '@/components/modals/RequestToJoinModal';
import { TOKEN_LABEL_POINTS } from '@/lib/labels';

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
  goal_type: 'total_referrals' | 'users_at_tier' | 'aggregate_spend' | 'total_squad_points' | 'squad_meetup'; // Added squad_meetup
  goal_target: number;
  goal_target_metadata?: {
    tier_name?: string;
    currency?: string;
    proximity_meters?: number;    // For squad_meetup
    time_window_minutes?: number; // For squad_meetup
  };
  // Add other fields from CommunityQuest that are needed by the UI
  scope?: 'community' | 'squad'; // Added scope to Quest interface
  rewards?: any[]; // Added rewards to Quest interface, consider defining a Reward type
  start_ts?: string; // Added start_ts
  end_ts?: string;   // Added end_ts
  status?: string;   // Added status
}

// Define a shared utility function for message construction if not already in a shared file
// This MUST match the backend's constructSignableMessage logic
const constructClientSignableMessage = (params: {
  questId: string,
  squadId: string,
  latitude: number,
  longitude: number,
  clientTimestampISO: string
}) => {
  return `DeFAI Squad Meetup Check-in: QuestID=${params.questId}, SquadID=${params.squadId}, Lat=${params.latitude.toFixed(6)}, Lon=${params.longitude.toFixed(6)}, Timestamp=${params.clientTimestampISO}`;
};

const QuestCard = ({ quest, progress, squadId }: { quest: Quest, progress?: QuestProgressData, squadId: string | undefined }) => {
    const { publicKey, signMessage } = useWallet();
    const [isCheckingIn, setIsCheckingIn] = useState(false);

    const handleCheckIn = async () => {
        if (!publicKey || !signMessage) {
            toast.error('Wallet not connected or does not support message signing.');
            return;
        }
        if (!squadId) {
            toast.error('Squad ID not available for check-in.');
            return;
        }
        if (quest.status !== 'active') {
            toast.info('This quest is not currently active.');
            return;
        }

        setIsCheckingIn(true);
        toast.info('Getting your location...');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                const clientTimestamp = new Date();
                const clientTimestampISO = clientTimestamp.toISOString();

                const messageToSign = constructClientSignableMessage({
                    questId: quest._id,
                    squadId: squadId,
                    latitude: latitude,
                    longitude: longitude,
                    clientTimestampISO: clientTimestampISO
                });

                try {
                    toast.info('Please sign the message in your wallet to confirm check-in.');
                    const messageBytes = new TextEncoder().encode(messageToSign);
                    const signatureBytes = await signMessage(messageBytes);
                    
                    // Convert signature to Base64
                    const signatureBase64 = Buffer.from(signatureBytes).toString('base64');

                    const payload = {
                        questId: quest._id,
                        squadId: squadId,
                        latitude,
                        longitude,
                        accuracy,
                        clientTimestamp: clientTimestampISO,
                        signedMessage: messageToSign,
                        signature: signatureBase64,
                    };

                    toast.info('Submitting your check-in...');
                    const response = await fetch('/api/quests/check-in', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                    });

                    const responseData = await response.json();
                    if (response.ok) {
                        toast.success(responseData.message || 'Check-in successful! Pending match.');
                    } else {
                        toast.error(responseData.error || 'Check-in failed. Please try again.');
                    }
                } catch (error: any) {
                    console.error("Check-in error:", error);
                    toast.error(error.message || 'An error occurred during check-in.');
                } finally {
                    setIsCheckingIn(false);
                }
            },
            (error) => {
                console.error("Geolocation error:", error);
                toast.error(`Geolocation error: ${error.message}`);
                setIsCheckingIn(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 } // Geolocation options
        );
    };

    const displayProgress = progress?.currentProgress || 0;
    // Adjust displayGoal based on quest type if necessary, for now it defaults to quest.goal_target
    let displayGoal = quest.goal_target;
    let goalDescription = `Goal: ${displayGoal}`;
    let additionalInfo = <></>;

    if (quest.goal_type === 'squad_meetup') {
        goalDescription = `Goal: At least ${quest.goal_target} members meet up.`;
        additionalInfo = (
            <>
                <p className="text-xs text-muted-foreground mt-1">
                    Meetup Conditions: 
                    Within {quest.goal_target_metadata?.proximity_meters || 'N/A'} meters, 
                    {quest.goal_target_metadata?.time_window_minutes || 'N/A'} minutes.
                </p>
                <button 
                    onClick={handleCheckIn}
                    disabled={isCheckingIn || quest.status !== 'active' || !squadId || !publicKey}
                    className="mt-2 px-3 py-1.5 text-xs font-medium text-center text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-800 disabled:opacity-50"
                >
                    {isCheckingIn ? 'Checking in...' : 'Check-in for Meetup'}
                </button>
            </>
        );
        // For meetup quests, progress might be represented differently (e.g., number of successful meetups recorded)
        // For now, the standard progress bar might not be perfectly representative.
    } else if (quest.goal_target_metadata?.currency) {
        goalDescription = `Goal: ${displayGoal.toLocaleString()} ${quest.goal_target_metadata.currency}`;
    } else if (quest.goal_target_metadata?.tier_name) {
        goalDescription = `Goal: ${displayGoal} users reach ${quest.goal_target_metadata.tier_name} tier`;
    }

    const percentage = displayGoal > 0 ? (displayProgress / displayGoal) * 100 : 0;

    return (
        <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-[#3366FF]">{quest.title}</CardTitle>
                    <Badge variant={quest.scope === 'squad' ? 'default' : 'secondary'}>
                        {quest.scope === 'squad' ? 'Squad Quest' : 'Community Quest'}
                    </Badge>
                </div>
                <CardDescription className="h-12 overflow-y-auto">{quest.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground font-medium">{goalDescription}</div>
                
                {quest.goal_type !== 'squad_meetup' && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{Math.round(percentage)}%</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                        <div className="text-xs text-muted-foreground">
                            {displayProgress.toLocaleString()} / {displayGoal.toLocaleString()}
                        </div>
                    </div>
                )}
                
                {quest.goal_type === 'squad_meetup' && (
                    <div className="space-y-2">
                        <div className="text-xs text-muted-foreground">
                            Meetup Conditions: Within {quest.goal_target_metadata?.proximity_meters || 'N/A'} meters, 
                            {quest.goal_target_metadata?.time_window_minutes || 'N/A'} minutes.
                        </div>
                        <Button 
                            onClick={handleCheckIn}
                            disabled={isCheckingIn || quest.status !== 'active' || !squadId || !publicKey}
                            size="sm"
                            className="w-full bg-[#3366FF] hover:bg-[#2952cc]"
                        >
                            <MapPin className="h-4 w-4 mr-2" />
                            {isCheckingIn ? 'Checking in...' : 'Check-in for Meetup'}
                        </Button>
                        <div className="text-xs text-muted-foreground">
                            {progress?.currentProgress ? `Meetups recorded: ${progress.currentProgress}` : 'No meetups recorded yet.'}
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {quest.status && (
                            <Badge className={quest.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}>
                                {quest.status}
                            </Badge>
                        )}
                        {quest.end_ts && (
                            <span>Ends: {new Date(quest.end_ts).toLocaleDateString()}</span>
                        )}
                    </div>
                    {progress?.updatedAt && (
                        <span className="text-xs text-muted-foreground">
                            Updated: {new Date(progress.updatedAt).toLocaleTimeString()}
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

interface SquadDetailPageParams {
    squadId: string;
}

export default function SquadDetailsPage() {
  const params = useParams();
  const router = useRouter();
  // Ensure squadId is a string, handle cases where it might not be.
  const squadId = typeof params?.squadId === 'string' ? params.squadId : null;
  const { publicKey, connected } = useWallet();
  const currentUserWalletAddress = publicKey?.toBase58();

  // Quest related state and logic
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
        const response = await fetch(`/api/quests/all?scope=squad&status=active`);
        if (!response.ok) throw new Error('Failed to fetch squad quests');
        const questsData = await response.json();
        setActiveSquadQuests(questsData.quests || questsData || []);
      } catch (err) {
        console.error("Error fetching squad quests:", err);
        setActiveSquadQuests([]); // Ensure it's an empty array on error
      }
      setIsLoadingQuests(false);
    };

    if (squadId) { // Ensure squadId is available before fetching
        fetchActiveSquadQuests();
    }
  }, [squadId]);
  // End of Quest related state and logic

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

  if (isLoading) return (
    <SidebarInset>
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3366FF]"></div>
        <p className='ml-3'>Loading squad details...</p>
      </div>
    </SidebarInset>
  );
  
  if (error) return (
    <SidebarInset>
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-xl mb-4">Error: {error}</p>
        <Button asChild>
          <Link href="/squads/browse">Browse Squads</Link>
        </Button>
      </div>
    </SidebarInset>
  );
  
  if (!squadDetails) return (
    <SidebarInset>
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-xl mb-4">Squad not found.</p>
        <Button asChild>
          <Link href="/squads/browse">Browse Squads</Link>
        </Button>
      </div>
    </SidebarInset>
  );

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-all ease-linear">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Platform</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink href="/squads">Squads</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{squadDetails?.name}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto flex items-center gap-4 px-4">
          {isUserLeader && (
            <Button size="sm" className="bg-[#3366FF] hover:bg-[#2952cc]">
              <Settings className="h-4 w-4 mr-2" />
              Manage Squad
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 py-6">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6">
            {/* Squad Overview Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-3xl">{squadDetails?.name}</CardTitle>
                    <CardDescription>{squadDetails?.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {isUserLeader && (
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditableSquadName(squadDetails?.name || '');
                          setEditableDescription(squadDetails?.description || '');
                          setIsEditingSquad(true);
                        }}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Edit Info
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {isEditingSquad && (
              <Card>
                <CardHeader>
                  <CardTitle>Edit Squad Information</CardTitle>
                  <CardDescription>Update your squad&apos;s name and description</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleEditSquadSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="editableSquadName" className="block text-sm font-medium mb-1">Squad Name</label>
                      <input 
                        type="text" 
                        id="editableSquadName" 
                        value={editableSquadName} 
                        onChange={(e) => setEditableSquadName(e.target.value)} 
                        className="w-full p-2 border rounded-md" 
                        maxLength={30} 
                      />
                    </div>
                    <div>
                      <label htmlFor="editableDescription" className="block text-sm font-medium mb-1">Description</label>
                      <textarea 
                        id="editableDescription" 
                        value={editableDescription} 
                        onChange={(e) => setEditableDescription(e.target.value)} 
                        rows={3} 
                        className="w-full p-2 border rounded-md" 
                        maxLength={150} 
                      />
                    </div>
                    <div className="flex justify-end space-x-3">
                      <Button type="button" variant="outline" onClick={() => setIsEditingSquad(false)} disabled={isSavingEdit}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSavingEdit} className="bg-[#3366FF] hover:bg-[#2952cc]">
                        {isSavingEdit ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Squad Leader</CardTitle>
                  <Crown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{squadDetails.leaderWalletAddress.substring(0,8)}...</div>
                  <p className="text-xs text-muted-foreground">
                    Squad commander
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Points</CardTitle>
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{squadDetails.totalSquadPoints.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Combined {TOKEN_LABEL_POINTS}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Members</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {squadDetails.membersFullDetails?.length || squadDetails.memberWalletAddresses.length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    / {squadDetails.maxMembers || process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS} max
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Average Points</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {squadDetails.membersFullDetails?.length ? 
                      Math.round(squadDetails.totalSquadPoints / squadDetails.membersFullDetails.length).toLocaleString() : 
                      '0'
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Per member
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Squad Members */}
            <Card>
              <CardHeader>
                <CardTitle>Squad Members</CardTitle>
                <CardDescription>
                  {squadDetails.membersFullDetails?.length || squadDetails.memberWalletAddresses.length} / {squadDetails.maxMembers || process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS} members
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {squadDetails.membersFullDetails && squadDetails.membersFullDetails.length > 0 ? (
                    squadDetails.membersFullDetails.map(member => (
                      <div key={member.walletAddress} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/5 transition-colors">
                        <div className="flex items-center gap-3">
                          <UserAvatar 
                            profileImageUrl={member.xProfileImageUrl}
                            username={member.xUsername}
                            size="sm"
                          />
                          <div>
                            <p className="font-medium">
                              {member.xUsername ? `@${member.xUsername}` : `${member.walletAddress.substring(0,6)}...`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {member.points?.toLocaleString() || '0'} {TOKEN_LABEL_POINTS}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {member.walletAddress === currentUserWalletAddress && (
                            <Badge variant="secondary">You</Badge>
                          )}
                          {member.walletAddress === squadDetails.leaderWalletAddress && (
                            <Badge className="bg-yellow-500">Leader</Badge>
                          )}
                          {isUserLeader && member.walletAddress !== currentUserWalletAddress && (
                            <div className="flex gap-1">
                              <Button 
                                size="sm"
                                variant="outline"
                                onClick={() => handleTransferLeadership(member.walletAddress)}
                                disabled={isKickingMember === member.walletAddress}
                              >
                                {isKickingMember === member.walletAddress ? 'Transferring...' : 'Make Leader'}
                              </Button>
                              <Button 
                                size="sm"
                                variant="destructive"
                                onClick={() => handleKickMember(member.walletAddress)}
                                disabled={isKickingMember === member.walletAddress}
                              >
                                {isKickingMember === member.walletAddress ? 'Kicking...' : 'Kick'}
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No member details available or squad is empty.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Member Actions */}
            {connected && isUserMember && !isUserLeader && (
              <Card>
                <CardHeader>
                  <CardTitle>Squad Actions</CardTitle>
                  <CardDescription>Manage your squad membership</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleLeaveSquad}
                    disabled={isLeaving}
                    variant="destructive"
                    className="w-full"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    {isLeaving ? 'Leaving Squad...' : 'Leave Squad'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Leader Tools */}
            {isUserLeader && squadDetails && (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl font-bold text-[#3366FF] mb-2">Leader Dashboard</h3>
                  <p className="text-muted-foreground text-sm">Manage your squad and members</p>
                </div>
                {/* Join Requests Management */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Pending Join Requests
                    </CardTitle>
                    <CardDescription>
                      {joinRequests.length} pending requests to review
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isFetchingJoinRequests && (
                      <div className="text-center py-4">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#3366FF]"></div>
                        <p className="mt-2 text-sm text-muted-foreground">Loading join requests...</p>
                      </div>
                    )}
                    {!isFetchingJoinRequests && joinRequests.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No pending join requests
                      </div>
                    )}
                    {!isFetchingJoinRequests && joinRequests.length > 0 && (
                      <div className="space-y-3 max-h-72 overflow-y-auto">
                        {joinRequests.map(req => (
                          <div key={req.requestId} className="p-3 border rounded-lg">
                            <div className="flex items-start gap-3">
                              <UserAvatar 
                                profileImageUrl={req.requestingUserXProfileImageUrl}
                                username={req.requestingUserXUsername}
                                size="sm"
                              />
                              <div className="flex-grow">
                                <p className="font-semibold">
                                  {req.requestingUserXUsername ? `@${req.requestingUserXUsername}` : `${req.requestingUserWalletAddress.substring(0,6)}...`}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono" title={req.requestingUserWalletAddress}>
                                  {req.requestingUserWalletAddress}
                                </p>
                                {req.message && (
                                  <p className="text-xs text-muted-foreground mt-1 italic bg-accent p-2 rounded">
                                    {req.message}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="mt-3 flex gap-2 justify-end">
                              <Button 
                                size="sm"
                                variant="destructive"
                                onClick={() => handleProcessJoinRequest(req.requestId, 'reject')}
                                disabled={isProcessingJoinRequest === req.requestId}
                              >
                                {isProcessingJoinRequest === req.requestId ? 'Rejecting...' : 'Reject'}
                              </Button>
                              <Button 
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleProcessJoinRequest(req.requestId, 'approve')}
                                disabled={isProcessingJoinRequest === req.requestId}
                              >
                                {isProcessingJoinRequest === req.requestId ? 'Approving...' : 'Approve'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Invite Members */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="h-4 w-4" />
                      Invite New Member
                    </CardTitle>
                    <CardDescription>Send invitations to expand your squad</CardDescription>
                  </CardHeader>
                  <CardContent>
                <div className="flex mb-4 bg-muted rounded-lg p-1 w-fit">
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
                    <label htmlFor="inviteeWallet" className="block text-sm font-medium text-foreground">
                      Wallet Address to Invite:
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        id="inviteeWallet" 
                        value={inviteeWalletAddress} 
                        onChange={(e) => setInviteeWalletAddress(e.target.value)} 
                        className="flex-grow p-2 bg-background border border-input rounded-md text-foreground placeholder-muted-foreground focus:ring-[#2B96F1] focus:border-[#2B96F1]"
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
                      <label htmlFor="inviteeTwitter" className="block text-sm font-medium text-foreground">
                        Twitter Handle to Invite:
                      </label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          id="inviteeTwitter" 
                          value={inviteeTwitterHandle} 
                          onChange={(e) => setInviteeTwitterHandle(e.target.value)} 
                          className="flex-grow p-2 bg-background border border-input rounded-md text-foreground placeholder-muted-foreground focus:ring-[#2B96F1] focus:border-[#2B96F1]"
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
                
                <div className="p-4 bg-muted border border-border rounded-lg mb-6">
                <h4 className="text-md font-semibold text-foreground mb-2">Pending Invites Sent:</h4>
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
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Request to Join for non-members */}
            {connected && !isUserMember && squadDetails && (
              <Card>
                <CardHeader>
                  <CardTitle>Join This Squad</CardTitle>
                  <CardDescription>Send a request to join this squad</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  {hasPendingRequestForThisSquad ? (
                    <Button disabled variant="outline" className="w-full">
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Request Pending
                    </Button>
                  ) : (
                    <Button 
                      onClick={handleOpenRequestModal}
                      className="w-full bg-[#3366FF] hover:bg-[#2952cc]"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Request to Join Squad
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Squad Quests */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Active Squad Quests
                </CardTitle>
                <CardDescription>Complete quests together as a squad</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingQuests && (
                  <div className="flex items-center justify-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#3366FF]"></div>
                    <p className="ml-2 text-muted-foreground">Loading quests...</p>
                  </div>
                )}
                {!isLoadingQuests && activeSquadQuests.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No active squad quests currently
                  </div>
                )}
                {!isLoadingQuests && activeSquadQuests.length > 0 && (
                  <div className="space-y-4">
                    {activeSquadQuests.map(quest => (
                      <QuestCard key={quest._id} quest={quest} progress={squadProgressMap[quest._id]} squadId={squadDetails?.squadId} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

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
    </SidebarInset>
  );
} 