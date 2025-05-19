// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from "next-auth/react";
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { checkRequiredEnvVars } from '@/utils/checkEnv';
import { useUserAirdrop, UserAirdropData } from '@/hooks/useUserAirdrop';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface ReferralBoost {
  id: string;
  expiresAt: string;
  multiplier: number;
}

interface UserData {
  points: number | null;
  initialAirdropAmount: number | null;
  initialDefai?: number | null;
  airBasedDefai?: number | null;
  totalDefai?: number | null;
  referralCode?: string;
  completedActions?: string[];
  xUsername?: string;
  squadId?: string;
  activeReferralBoosts?: ReferralBoost[];
}

export function useHomePageLogic() {
  const { data: session, status: authStatus, update: updateSession } = useSession();
  const wallet = useWallet();
  const { connection } = useConnection();
  const router = useRouter();

  // Integrate useUserAirdrop hook
  const userAirdrop = useUserAirdrop();

  // State for airdrop check (for typed address, not necessarily connected user)
  const [typedAddress, setTypedAddress] = useState('');
  const [airdropCheckResultForTyped, setAirdropCheckResult] = useState<number | string | null>(null);
  const [isCheckingAirdrop, setIsCheckingAirdrop] = useState(false);
  
  // Rewards system state - some of this will now be derived or use userAirdrop hook data
  const [isRewardsActive, setIsRewardsActive] = useState(false);
  const [isActivatingRewards, setIsActivatingRewards] = useState(false);
  // userData will still hold other user-specific details not covered by useUserAirdrop (e.g., referralCode, completedActions other than points)
  const [userData, setUserData] = useState<UserData | null>(null);
  
  const [mySquadData, setMySquadData] = useState<any>(null);
  const [isFetchingSquad, setIsFetchingSquad] = useState(false);
  const [userCheckedNoSquad, setUserCheckedNoSquad] = useState(false);
  const [initialReferrer, setInitialReferrer] = useState(null);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [isFetchingInvites, setIsFetchingInvites] = useState(false);
  const [isProcessingInvite, setIsProcessingInvite] = useState<string | null>(null);
  const [squadInviteIdFromUrl, setSquadInviteIdFromUrl] = useState(null);
  // currentTotalAirdropForSharing can now be primarily userAirdrop.totalDefai if it represents the connected user's airdrop
  // If it needs to include DeFAI balance from other sources, it might be calculated separately.
  // For now, let's assume it aligns with the connected user's total airdrop.
  const [currentTotalAirdropForSharing, setCurrentTotalAirdropForSharing] = useState<number>(0);

  const [isCheckingDefaiBalance, setIsCheckingDefaiBalance] = useState(false);
  const [hasSufficientDefai, setHasSufficientDefai] = useState<boolean | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isProcessingLinkInvite, setIsProcessingLinkInvite] = useState(false);
  const [activationAttempted, setActivationAttempted] = useState(false);
  const [prevWalletAddress, setPrevWalletAddress] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [totalCommunityPoints, setTotalCommunityPoints] = useState<number | null>(null);
  const [defaiBalance, setDefaiBalance] = useState<number | null>(null);

  // Combine userData from userAirdrop hook and otherUserData
  const combinedUserData = {
    ...userData,
    points: userAirdrop.points,
    initialAirdropAmount: userAirdrop.initialDefai, // For clarity if `initialDefai` is used as airdrop amount
    // other fields like referralCode, completedActions, xUsername, squadId are in userData
  };

  useEffect(() => {
    if (userAirdrop.totalDefai !== null) {
        setCurrentTotalAirdropForSharing(userAirdrop.totalDefai + (defaiBalance || 0));
    } else if (defaiBalance !== null) {
        setCurrentTotalAirdropForSharing(defaiBalance);
    } else {
        setCurrentTotalAirdropForSharing(0);
    }
  }, [userAirdrop.totalDefai, defaiBalance]);


  // Callbacks - some might need adjustment if userAirdrop hook provides the data
  const handleWalletConnectSuccess = useCallback(async () => {
    console.log("[HomePage] handleWalletConnectSuccess called");
    if (!wallet.publicKey || !session?.user?.xId) {
      console.log("[HomePage] handleWalletConnectSuccess: Aborting - no publicKey or session.user.xId", { hasPublicKey: !!wallet.publicKey, hasXId: !!session?.user?.xId });
      return;
    }
    console.log("[HomePage] handleWalletConnectSuccess: Proceeding to link wallet");
    toast.info("Linking your wallet to your X account...");
    try {
      const response = await fetch('/api/users/link-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet.publicKey.toBase58() }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log("[HomePage] handleWalletConnectSuccess: Wallet linked successfully via API, updating session.");
        toast.success(data.message || "Wallet linked successfully!");
        await updateSession(); 
      } else {
        console.error("[HomePage] handleWalletConnectSuccess: API error linking wallet", data);
        toast.error(data.error || "Failed to link wallet.");
      }
    } catch (error) {
      console.error("[HomePage] handleWalletConnectSuccess: Exception linking wallet", error);
      toast.error("An error occurred while linking your wallet.");
    }
  }, [wallet.publicKey, session, updateSession]);

  const fetchMySquadData = useCallback(async (userWalletAddress: string | null | undefined) => {
    if (!userWalletAddress || isFetchingSquad || userCheckedNoSquad) return;
    console.log("[HomePage] Fetching squad data for:", userWalletAddress);
    setIsFetchingSquad(true);
    try {
      const response = await fetch(`/api/squads/my-squad?userWalletAddress=${encodeURIComponent(userWalletAddress)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.squad) {
          console.log("[HomePage] Squad data received:", data.squad);
          setMySquadData(data.squad);
          setUserCheckedNoSquad(false);
        } else {
          console.log("[HomePage] User not in a squad or no squad data.");
          setMySquadData(null);
          setUserCheckedNoSquad(true);
        }
      } else {
        const errorData = await response.json();
        console.error("[HomePage] Failed to fetch squad data:", errorData.error || response.statusText);
        setMySquadData(null);
        if (response.status === 404) {
          setUserCheckedNoSquad(true);
        }
      }
    } catch (error) {
      console.error("[HomePage] Error fetching squad data:", error);
      setMySquadData(null);
    }
    setIsFetchingSquad(false);
  }, [isFetchingSquad, userCheckedNoSquad]);

  const fetchPendingInvites = useCallback(async () => {
    console.log("[HomePage] fetchPendingInvites called");
    if (!wallet.connected || !session || !session.user?.xId) {
        console.log("[HomePage] fetchPendingInvites: Aborting - wallet not connected or no session/xId.");
        return;
    }
    if(isFetchingInvites) {
        console.log("[HomePage] fetchPendingInvites: Aborting - already fetching.");
        return;
    }
    setIsFetchingInvites(true);
    console.log("[HomePage] fetchPendingInvites: Fetching...");
    try {
      const response = await fetch('/api/squads/invitations/my-pending');
      if (response.ok) {
        const data = await response.json();
        setPendingInvites(data.invitations || []);
        console.log("[HomePage] fetchPendingInvites: Success", data);
      } else {
        console.error("[HomePage] fetchPendingInvites: API error", await response.text());
        setPendingInvites([]);
      }
    } catch (error) {
      console.error("[HomePage] fetchPendingInvites: Exception", error);
      setPendingInvites([]);
    }
    setIsFetchingInvites(false);
  }, [wallet.connected, session, isFetchingInvites]);

  const checkDefaiBalance = useCallback(async (userPublicKey: PublicKey | null, conn: any) => {
    if (!userPublicKey || !conn) {
        console.log("[HomePage] checkDefaiBalance: Aborting - no publicKey or connection");
        return;
    }
    console.log("[HomePage] checkDefaiBalance called with", userPublicKey.toBase58());
    setIsCheckingDefaiBalance(true);
    const tokenMintAddress = process.env.NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS;
    const tokenDecimals = parseInt(process.env.NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS || '9', 10);
    const requiredDefaiAmount = parseInt(process.env.NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT || '5000', 10);

    if (tokenMintAddress) {
      try {
        const mint = new PublicKey(tokenMintAddress);
        const ata = await getAssociatedTokenAddress(mint, userPublicKey);
        const accountInfo = await getAccount(conn, ata, 'confirmed');
        const balance = Number(accountInfo.amount) / (10 ** tokenDecimals);
        setDefaiBalance(balance);
        setHasSufficientDefai(balance >= requiredDefaiAmount);
      } catch (e) {
        console.warn("Could not fetch DeFAI balance", e);
        setDefaiBalance(0);
        setHasSufficientDefai(false);
      }
    }
    setIsCheckingDefaiBalance(false);
  }, []);

  const activateRewardsAndFetchData = useCallback(async (connectedWalletAddress: string, xUserId: string, userDbId: string | undefined) => {
    console.log("[HomePage] activateRewardsAndFetchData called", { connectedWalletAddress, xUserId, userDbId, initialReferrer, squadInviteIdFromUrl });
    setActivationAttempted(true);
    setIsActivatingRewards(true);
    toast.info("Activating your DeFAI Rewards account...");
    try {
      const response = await fetch('/api/users/activate-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress: connectedWalletAddress, 
          xUserId: xUserId, 
          userDbId: userDbId, 
          referredByCode: initialReferrer, // Ensure backend expects referredByCode
          squadInviteIdFromUrl: squadInviteIdFromUrl 
        }),
      });
      const data = await response.json(); // This data is from activate-rewards API
      if (response.ok) {
        console.log("[HomePage] activateRewardsAndFetchData: Success", data);
        // userAirdrop hook will fetch points. We primarily set other user data here.
        setUserData({
            referralCode: data.referralCode,
            completedActions: data.completedActions,
            xUsername: data.xUsername,
            squadId: data.squadId,
            // Points and initialAirdropAmount will come from userAirdrop hook
        });
        setIsRewardsActive(true);
        if (connectedWalletAddress) {
          fetchMySquadData(connectedWalletAddress);
          fetchPendingInvites();
        }
        if (wallet.publicKey && connection) {
          checkDefaiBalance(wallet.publicKey, connection);
        }
      } else {
        console.error("[HomePage] activateRewardsAndFetchData: API error", data);
        setIsRewardsActive(false);
        setUserData({});
      }
    } catch (error) {
      console.error("[HomePage] activateRewardsAndFetchData: Exception", error);
      setIsRewardsActive(false);
      setUserData({});
    }
    setIsActivatingRewards(false);
  }, [initialReferrer, squadInviteIdFromUrl, fetchMySquadData, fetchPendingInvites, checkDefaiBalance, wallet.publicKey, connection]);

  // Main orchestration effect: Remains largely the same, conditions will naturally use updated states.
  // ... (existing main useEffect logic - no major changes here, but its conditions will now react to userAirdrop.isLoading etc. implicitly)
  useEffect(() => {
    console.log("[HomePage] Main Effect Triggered", {
      authStatus,
      sessionExists: !!session,
      walletConnected: wallet.connected,
      walletAddressInSession: !!session?.user?.walletAddress,
      isActivatingRewards,
      isRewardsActive,
      activationAttempted,
      isFetchingInvites,
      userAirdropLoading: userAirdrop.isLoading, // Log hook loading state
    });

    if (
      authStatus === "authenticated" &&
      session?.user?.xId &&
      wallet.connected &&
      wallet.publicKey &&
      !session?.user?.walletAddress && // Key: session doesn't have wallet yet
      !isActivatingRewards // And not currently trying to link/activate
    ) {
      console.log("[HomePage] Main Effect: Condition for handleWalletConnectSuccess met");
      handleWalletConnectSuccess();
    } else if (
      authStatus === "authenticated" &&
      session?.user?.xId &&
      session?.user?.walletAddress && // Wallet is now in session
      wallet.connected &&
      wallet.publicKey &&
      !isRewardsActive && // Rewards not yet marked active locally
      !isActivatingRewards &&
      !activationAttempted // Haven't tried activating yet for this combo
    ) {
      console.log("[HomePage] Main Effect: Condition for activateRewardsAndFetchData met");
      activateRewardsAndFetchData(
        wallet.publicKey.toBase58(),
        session.user.xId,
        session.user.dbId
      );
    } else if (
      authStatus === "authenticated" &&
      wallet.connected &&
      wallet.publicKey &&
      session?.user?.walletAddress &&
      isRewardsActive &&
      hasSufficientDefai === null && // Only if not yet checked or changed
      !isCheckingDefaiBalance
    ) {
      console.log("[HomePage] Main Effect: Condition for checking DeFAI balance met");
      checkDefaiBalance(wallet.publicKey, connection);
    } else if (
      authStatus === "authenticated" &&
      wallet.connected &&
      session?.user?.walletAddress &&
      isRewardsActive && // Only if rewards are active
      !isFetchingInvites // And not already fetching invites
    ) {
      console.log("[HomePage] Main Effect: Condition for fetching pending invites met");
      fetchPendingInvites();
    }

    // Reset on wallet disconnect if rewards were active
    if (authStatus === "authenticated" && !wallet.connected && isRewardsActive) {
      console.log("[HomePage] Main Effect: Wallet disconnected while rewards active, resetting.");
      setIsRewardsActive(false);
      setUserData({}); // Reset other user data
      setMySquadData(null);
      setUserCheckedNoSquad(false);
      setHasSufficientDefai(null);
      // userAirdrop hook will reset its state based on wallet.connected change
    }
  }, [
    authStatus,
    session,
    wallet.connected,
    wallet.publicKey,
    isRewardsActive,
    isActivatingRewards,
    activationAttempted,
    handleWalletConnectSuccess,
    activateRewardsAndFetchData,
    fetchMySquadData, // Added as it's called inside activateRewardsAndFetchData
    fetchPendingInvites,
    checkDefaiBalance,
    hasSufficientDefai,
    isCheckingDefaiBalance,
    isFetchingInvites,
    connection,
    userAirdrop.isLoading, // Add hook loading state as dependency
  ]);


  // Other effects: largely unchanged
  useEffect(() => {
    checkRequiredEnvVars();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref');
      if (refCode) {
         localStorage.setItem('referralCode', refCode);
         setInitialReferrer(refCode);
      } else {
         const savedRefCode = localStorage.getItem('referralCode');
         if (savedRefCode) setInitialReferrer(savedRefCode);
      }

      const squadInviteParam = urlParams.get('squadInvite');
      if (squadInviteParam) {
        setSquadInviteIdFromUrl(squadInviteParam);
        console.log("[HomePage] Squad Invite ID from URL:", squadInviteParam);
      }
    }
  }, []);

  useEffect(() => {
    const currentAddress = wallet.publicKey ? wallet.publicKey.toBase58() : null;

    if (!wallet.connected) {
      setPrevWalletAddress(null);
      setActivationAttempted(false); 
      return;
    }

    if (currentAddress && currentAddress !== prevWalletAddress) {
      setPrevWalletAddress(currentAddress);
      setUserCheckedNoSquad(false); 
      setActivationAttempted(false); 
      setIsRewardsActive(false); // Reset rewards active status for new wallet
      setUserData({});      // Reset other user data
      setMySquadData(null);
      setHasSufficientDefai(null); 
      setPendingInvites([]);
      // userAirdrop hook will re-fetch due to publicKey change
    }
  }, [wallet.connected, wallet.publicKey, prevWalletAddress]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkDesktop = () => {
        setIsDesktop(window.innerWidth >= 1024);
      };
      checkDesktop();
      window.addEventListener('resize', checkDesktop);
      return () => window.removeEventListener('resize', checkDesktop);
    }
  }, []);

  useEffect(() => {
    fetch('/api/stats/total-points')
      .then(async res => {
        if (!res.ok) throw new Error('Network error fetching total points');
        return res.json();
      })
      .then(data => {
        if (data.totalCommunityPoints !== undefined && data.totalCommunityPoints !== null) {
          setTotalCommunityPoints(data.totalCommunityPoints);
        } else {
          setTotalCommunityPoints(0);
        }
      })
      .catch(err => {
        console.error("Failed to fetch total community points for dashboard", err);
        setTotalCommunityPoints(0);
      });
  }, []);

  return {
    // Auth & Wallet
    session,
    authStatus,
    wallet,
    connection,

    // State derived from/related to useUserAirdrop
    userAirdropData: userAirdrop, // Expose the whole hook data object
    userData: combinedUserData, // Expose combined data (other details + points from hook)

    // Original state values that are still managed by useHomePageLogic
    typedAddress,
    setTypedAddress,
    airdropCheckResultForTyped, // Renamed from airdropCheckResult
    setAirdropCheckResult, // Keep prop name consistent if page.tsx uses it
    isCheckingAirdrop, // Renamed
    setIsCheckingAirdrop, // Keep prop name consistent
    
    isRewardsActive,
    isActivatingRewards,
    // setUserData, // This is now managed by setUserData and userAirdrop hook
    setUserData, // Expose if needed for direct updates of non-point/airdrop data
    
    mySquadData,
    isFetchingSquad,
    userCheckedNoSquad,
    initialReferrer,
    pendingInvites,
    isFetchingInvites,
    isProcessingInvite,
    setIsProcessingInvite,
    squadInviteIdFromUrl,
    currentTotalAirdropForSharing, // This is now derived from userAirdrop.totalDefai + defaiBalance
    setCurrentTotalAirdropForSharing, // Still needed if page.tsx sets it from other sources (e.g. AirdropInfoDisplay)

    isCheckingDefaiBalance,
    hasSufficientDefai,
    showWelcomeModal,
    setShowWelcomeModal,
    isProcessingLinkInvite,
    setIsProcessingLinkInvite,
    activationAttempted,
    isDesktop,
    totalCommunityPoints,
    setTotalCommunityPoints,
    defaiBalance,
    setDefaiBalance,

    // Callbacks
    handleWalletConnectSuccess,
    fetchMySquadData,
    fetchPendingInvites,
    checkDefaiBalance,
    activateRewardsAndFetchData,
  };
} 