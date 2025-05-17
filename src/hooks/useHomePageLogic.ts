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

export function useHomePageLogic() {
  const { data: session, status: authStatus, update: updateSession } = useSession();
  const wallet = useWallet();
  const { connection } = useConnection();
  const router = useRouter();

  // State for airdrop check
  const [typedAddress, setTypedAddress] = useState('');
  const [airdropCheckResult, setAirdropCheckResult] = useState(null);
  const [isCheckingAirdrop, setIsCheckingAirdrop] = useState(false);
  
  // State for rewards system
  const [isRewardsActive, setIsRewardsActive] = useState(false);
  const [isActivatingRewards, setIsActivatingRewards] = useState(false);
  const [userData, setUserData] = useState(null);
  const [mySquadData, setMySquadData] = useState(null);
  const [isFetchingSquad, setIsFetchingSquad] = useState(false);
  const [userCheckedNoSquad, setUserCheckedNoSquad] = useState(false);
  const [initialReferrer, setInitialReferrer] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [isFetchingInvites, setIsFetchingInvites] = useState(false);
  const [isProcessingInvite, setIsProcessingInvite] = useState(null);
  const [squadInviteIdFromUrl, setSquadInviteIdFromUrl] = useState(null);
  const [currentTotalAirdropForSharing, setCurrentTotalAirdropForSharing] = useState(0);
  const [isCheckingDefaiBalance, setIsCheckingDefaiBalance] = useState(false);
  const [hasSufficientDefai, setHasSufficientDefai] = useState(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isProcessingLinkInvite, setIsProcessingLinkInvite] = useState(false);
  const [activationAttempted, setActivationAttempted] = useState(false);
  const [prevWalletAddress, setPrevWalletAddress] = useState(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [totalCommunityPoints, setTotalCommunityPoints] = useState(null);
  const [defaiBalance, setDefaiBalance] = useState(null);

  // Callbacks
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

  const fetchMySquadData = useCallback(async (userWalletAddress) => {
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

  const checkDefaiBalance = useCallback(async (userPublicKey, conn) => {
    if (!userPublicKey || !conn) {
        console.log("[HomePage] checkDefaiBalance: Aborting - no publicKey or connection");
        return;
    }
    console.log("[HomePage] checkDefaiBalance called with", userPublicKey.toBase58());
    setIsCheckingDefaiBalance(true);
    const tokenMintAddress = process.env.NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS;
    const tokenDecimals = parseInt(process.env.NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS || '9', 10);
    if (tokenMintAddress) {
      try {
        const mint = new PublicKey(tokenMintAddress);
        const ata = await getAssociatedTokenAddress(mint, userPublicKey);
        const accountInfo = await getAccount(conn, ata, 'confirmed');
        const balance = Number(accountInfo.amount) / (10 ** tokenDecimals);
        setDefaiBalance(balance);
        setHasSufficientDefai(balance >= 5000); // TODO: Use REQUIRED_DEFAI_AMOUNT from env
      } catch (e) {
        console.warn("Could not fetch DeFAI balance", e);
        setDefaiBalance(0);
        setHasSufficientDefai(false);
      }
    }
    setIsCheckingDefaiBalance(false);
  }, []);

  const activateRewardsAndFetchData = useCallback(async (connectedWalletAddress, xUserId, userDbId) => {
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
          referrerCodeFromQuery: initialReferrer, 
          squadInviteIdFromUrl: squadInviteIdFromUrl 
        }),
      });
      const data = await response.json();
      if (response.ok) {
        console.log("[HomePage] activateRewardsAndFetchData: Success", data);
        setUserData(data);
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
        setUserData(null);
      }
    } catch (error) {
      console.error("[HomePage] activateRewardsAndFetchData: Exception", error);
      setIsRewardsActive(false);
      setUserData(null);
    }
    setIsActivatingRewards(false);
  }, [initialReferrer, squadInviteIdFromUrl, fetchPendingInvites, checkDefaiBalance, wallet.publicKey, connection]);

  // Main orchestration effect
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
    });

    if (
      authStatus === "authenticated" &&
      session?.user?.xId &&
      wallet.connected &&
      wallet.publicKey &&
      !session?.user?.walletAddress &&
      !isActivatingRewards
    ) {
      console.log("[HomePage] Main Effect: Condition for handleWalletConnectSuccess met");
      handleWalletConnectSuccess();
    } else if (
      authStatus === "authenticated" &&
      session?.user?.xId &&
      session?.user?.walletAddress &&
      wallet.connected &&
      wallet.publicKey &&
      !isRewardsActive &&
      !isActivatingRewards &&
      !activationAttempted
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
      hasSufficientDefai === null &&
      !isCheckingDefaiBalance
    ) {
      console.log("[HomePage] Main Effect: Condition for checking DeFAI balance met");
      checkDefaiBalance(wallet.publicKey, connection);
    } else if (
      authStatus === "authenticated" &&
      wallet.connected &&
      session?.user?.walletAddress &&
      isRewardsActive &&
      !isFetchingInvites
    ) {
      console.log("[HomePage] Main Effect: Condition for fetching pending invites met");
      fetchPendingInvites();
    }

    if (authStatus === "authenticated" && !wallet.connected && isRewardsActive) {
      console.log("[HomePage] Main Effect: Wallet disconnected while rewards active, resetting.");
      setIsRewardsActive(false);
      setUserData(null);
      setMySquadData(null);
      setUserCheckedNoSquad(false);
      setHasSufficientDefai(null);
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
    fetchPendingInvites,
    checkDefaiBalance,
    hasSufficientDefai,
    isCheckingDefaiBalance,
    isFetchingInvites,
    connection,
  ]);

  // Other effects
  useEffect(() => {
    checkRequiredEnvVars();
  }, []);

  useEffect(() => {
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
      setIsRewardsActive(false);
      setUserData(null);
      setMySquadData(null);
      setHasSufficientDefai(null); 
      setPendingInvites([]);
    }
  }, [wallet.connected, wallet.publicKey, prevWalletAddress]);

  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  useEffect(() => {
    fetch('/api/stats/total-points')
      .then(async res => {
        if (!res.ok) throw new Error('Network');
        return res.json();
      })
      .then(data => {
        if (data.totalCommunityPoints > 0) {
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

    // State
    typedAddress,
    setTypedAddress,
    airdropCheckResult,
    setAirdropCheckResult,
    isCheckingAirdrop,
    setIsCheckingAirdrop,
    isRewardsActive,
    isActivatingRewards,
    userData,
    setUserData,
    mySquadData,
    isFetchingSquad,
    userCheckedNoSquad,
    initialReferrer,
    pendingInvites,
    isFetchingInvites,
    isProcessingInvite,
    setIsProcessingInvite,
    squadInviteIdFromUrl,
    currentTotalAirdropForSharing,
    setCurrentTotalAirdropForSharing,
    isCheckingDefaiBalance,
    hasSufficientDefai,
    showWelcomeModal,
    setShowWelcomeModal,
    isProcessingLinkInvite,
    setIsProcessingLinkInvite,
    activationAttempted,
    isDesktop,
    totalCommunityPoints,
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