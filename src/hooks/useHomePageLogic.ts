// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signIn, signOut as nextAuthSignOut } from "next-auth/react";
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { checkRequiredEnvVars } from '@/utils/checkEnv';
import { useUserAirdrop, UserAirdropData } from '@/hooks/useUserAirdrop';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

export function useHomePageLogic() {
  const { data: session, status: authStatus, update: updateSession } = useSession();
  const wallet = useWallet();
  const { connection } = useConnection();
  const router = useRouter();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const walletPromptedRef = useRef(false);
  const prevConnectedRef = useRef<boolean | undefined>(undefined);

  // Integrate useUserAirdrop hook
  const userAirdrop = useUserAirdrop();

  // State for airdrop check (for typed address, not necessarily connected user)
  const [typedAddress, setTypedAddress] = useState('');
  const [airdropCheckResultForTyped, setAirdropCheckResultForTyped] = useState<number | string | null>(null);
  const [isCheckingAirdropForTyped, setIsCheckingAirdropForTyped] = useState(false);
  
  // Rewards system state - some of this will now be derived or use userAirdrop hook data
  const [isRewardsActive, setIsRewardsActive] = useState(false);
  const [isActivatingRewards, setIsActivatingRewards] = useState(false);
  // userData will still hold other user-specific details not covered by useUserAirdrop (e.g., referralCode, completedActions other than points)
  const [otherUserData, setOtherUserData] = useState<Partial<UserAirdropData & { referralCode?: string; completedActions?: string[]; xUsername?: string; squadId?: string }>>({});
  
  const [mySquadData, setMySquadData] = useState(null);
  const [isFetchingSquad, setIsFetchingSquad] = useState(false);
  const [userCheckedNoSquad, setUserCheckedNoSquad] = useState(false);
  const [initialReferrer, setInitialReferrer] = useState(null);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [isFetchingInvites, setIsFetchingInvites] = useState(false);
  const [isProcessingInvite, setIsProcessingInvite] = useState(null);
  const [squadInviteIdFromUrl, setSquadInviteIdFromUrl] = useState(null);
  // currentTotalAirdropForSharing can now be primarily userAirdrop.totalDefai if it represents the connected user's airdrop
  // If it needs to include DeFAI balance from other sources, it might be calculated separately.
  // For now, let's assume it aligns with the connected user's total airdrop.
  const [currentTotalAirdropForSharing, setCurrentTotalAirdropForSharing] = useState(0);

  const [isCheckingDefaiBalance, setIsCheckingDefaiBalance] = useState(false);
  const [hasSufficientDefai, setHasSufficientDefai] = useState<boolean | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [isProcessingLinkInvite, setIsProcessingLinkInvite] = useState(false);
  const [activationAttempted, setActivationAttempted] = useState(false);
  const [prevWalletAddress, setPrevWalletAddress] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [totalCommunityPoints, setTotalCommunityPoints] = useState<number | null>(null);
  const [defaiBalance, setDefaiBalance] = useState<number | null>(null);
  const [isWalletSigningIn, setIsWalletSigningIn] = useState(false);
  const [walletSignInAttempted, setWalletSignInAttempted] = useState(false);
  const [userDetailsFetched, setUserDetailsFetched] = useState(false);

  // Combine userData from userAirdrop hook and otherUserData
  const combinedUserData = {
    ...otherUserData,
    points: userAirdrop.points,
    initialAirdropAmount: userAirdrop.initialDefai, // For clarity if `initialDefai` is used as airdrop amount
    // other fields like referralCode, completedActions, xUsername, squadId are in otherUserData
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
    // console.log("[HomePage] handleWalletConnectSuccess called");
    if (!wallet.publicKey || !session?.user?.xId) {
      // console.log("[HomePage] handleWalletConnectSuccess: Aborting - no publicKey or session.user.xId", { hasPublicKey: !!wallet.publicKey, hasXId: !!session?.user?.xId });
      return;
    }
    // console.log("[HomePage] handleWalletConnectSuccess: Proceeding to link wallet");
    toast.info("Linking your wallet to your X account...");
    try {
      const response = await fetch('/api/users/link-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet.publicKey.toBase58() }),
      });
      const data = await response.json();
      if (response.ok) {
        // console.log("[HomePage] handleWalletConnectSuccess: Wallet linked successfully via API, updating session.");
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
    // console.log("[HomePage] Fetching squad data for:", userWalletAddress);
    setIsFetchingSquad(true);
    try {
      const response = await fetch(`/api/squads/my-squad?userWalletAddress=${encodeURIComponent(userWalletAddress)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.squad) {
          // console.log("[HomePage] Squad data received:", data.squad);
          setMySquadData(data.squad);
          setUserCheckedNoSquad(false);
        } else {
          // console.log("[HomePage] User not in a squad or no squad data.");
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
    // console.log("[HomePage] fetchPendingInvites called");
    if (!wallet.connected || !session || !session.user?.xId) {
        // console.log("[HomePage] fetchPendingInvites: Aborting - wallet not connected or no session/xId.");
        return;
    }
    if(isFetchingInvites) {
        // console.log("[HomePage] fetchPendingInvites: Aborting - already fetching.");
        return;
    }
    setIsFetchingInvites(true);
    // console.log("[HomePage] fetchPendingInvites: Fetching...");
    try {
      const response = await fetch('/api/squads/invitations/my-pending');
      if (response.ok) {
        const data = await response.json();
        setPendingInvites(data.invitations || []);
        // console.log("[HomePage] fetchPendingInvites: Success", data);
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
        // console.log("[HomePage] checkDefaiBalance: Aborting - no publicKey or connection");
        return;
    }
    // console.log("[HomePage] checkDefaiBalance called with", userPublicKey.toBase58());
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
    // console.log("[HomePage] activateRewardsAndFetchData called", { connectedWalletAddress, xUserId, userDbId, initialReferrer, squadInviteIdFromUrl });
    setActivationAttempted(true);
    setIsActivatingRewards(true);
    const referralCodeToUse = initialReferrer;
    toast.info("Activating your DeFAI Rewards account...");
    try {
      const response = await fetch('/api/users/activate-rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress: connectedWalletAddress, 
          xUserId: xUserId, 
          userDbId: userDbId, 
          referredByCode: referralCodeToUse,
          squadInviteIdFromUrl: squadInviteIdFromUrl 
        }),
      });
      const data = await response.json();
      // console.log("[HomePageLogic] Raw data from /api/users/activate-rewards:", JSON.stringify(data, null, 2));
      // if (data && typeof data === 'object') {
      //   console.log("[HomePageLogic] data.referralCode from API:", data.referralCode);
      //   console.log("[HomePageLogic] data.user (if exists from API call itself):", JSON.stringify(data.user, null, 2));
      // }

      if (response.ok) {
        const userFromResponse = data.user || data;

        setOtherUserData({
            referralCode: userFromResponse.referralCode,
            completedActions: userFromResponse.completedActions,
            xUsername: userFromResponse.xUsername,
            squadId: userFromResponse.squadId,
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
        setOtherUserData({});
      }
    } catch (error) {
      console.error("[HomePage] activateRewardsAndFetchData: Exception", error);
      setIsRewardsActive(false);
      setOtherUserData({});
    }
    setIsActivatingRewards(false);
  }, [initialReferrer, squadInviteIdFromUrl, fetchMySquadData, fetchPendingInvites, checkDefaiBalance, wallet.publicKey, connection]);

  // Main orchestration effect: Remains largely the same, conditions will naturally use updated states.
  // ... (existing main useEffect logic - no major changes here, but its conditions will now react to userAirdrop.isLoading etc. implicitly)
  useEffect(() => {
    // console.log("[HomePage] Main Effect Triggered", {
    //   authStatus,
    //   sessionExists: !!session,
    //   walletConnected: wallet.connected,
    //   walletAddressInSession: !!session?.user?.walletAddress,
    //   isActivatingRewards,
    //   isRewardsActive,
    //   activationAttempted,
    //   isFetchingInvites,
    //   userAirdropLoading: userAirdrop.isLoading, // Log hook loading state
    // });

    if (
      authStatus === "authenticated" &&
      session?.user?.xId &&
      wallet.connected &&
      wallet.publicKey &&
      !session?.user?.walletAddress && // Key: session doesn't have wallet yet
      !isActivatingRewards // And not currently trying to link/activate
    ) {
      // console.log("[HomePage] Main Effect: Condition for handleWalletConnectSuccess met");
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
      // console.log("[HomePage] Main Effect: Condition for activateRewardsAndFetchData met");
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
      // console.log("[HomePage] Main Effect: Condition for checking DeFAI balance met");
      checkDefaiBalance(wallet.publicKey, connection);
    } else if (
      authStatus === "authenticated" &&
      wallet.connected &&
      session?.user?.walletAddress &&
      isRewardsActive && // Only if rewards are active
      !isFetchingInvites // And not already fetching invites
    ) {
      // console.log("[HomePage] Main Effect: Condition for fetching pending invites met");
      fetchPendingInvites();
    }

    // Reset on wallet disconnect if rewards were active
    if (authStatus === "authenticated" && !wallet.connected && isRewardsActive) {
      // console.log("[HomePage] Main Effect: Wallet disconnected while rewards active, resetting.");
      setIsRewardsActive(false);
      setOtherUserData({}); // Reset other user data
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

  // ===== New Effect: Automatically authenticate with wallet credentials =====
  useEffect(() => {
    if (
      wallet.connected &&
      wallet.publicKey &&
      authStatus !== 'authenticated' &&
      !isWalletSigningIn &&
      !walletSignInAttempted
    ) {
      // console.log('[HomePageLogic DEBUG] Wallet connected, attempting NextAuth credentials sign-in.');
      setIsWalletSigningIn(true);
      setWalletSignInAttempted(true);
      
      const determinedChain = "solana"; 
      // console.log(`[HomePageLogic DEBUG] Determined chain for signIn: ${determinedChain}`);

      signIn('wallet', { 
        walletAddress: wallet.publicKey.toBase58(), 
        chain: determinedChain, 
        redirect: false 
      })
        .then(async (res) => {
          // console.log("[HomePageLogic DEBUG] NextAuth signIn response:", JSON.stringify(res, null, 2));
          if (res?.error) {
            console.error('[HomePageLogic] Wallet sign-in returned error:', res.error);
          } else if (res?.ok) {
            // console.log("[HomePageLogic] Wallet sign-in successful via NextAuth, updating session.");
            try {
              await updateSession(); 
              // console.log("[HomePageLogic] NextAuth session updated after wallet sign-in.");
            } catch (e) {
              console.warn('[HomePageLogic] updateSession after wallet sign-in failed', e);
            }
          } else {
             console.warn("[HomePageLogic] Wallet sign-in response was not ok and had no error object:", res);
          }
        })
        .catch((err) => {
          console.error('[HomePageLogic] Wallet sign-in failed (exception):', err);
        })
        .finally(() => {
          setIsWalletSigningIn(false);
        });
    }
  }, [wallet.connected, wallet.publicKey, authStatus, isWalletSigningIn, walletSignInAttempted, updateSession]);

  // === Fetch user completed actions & other details once authenticated ===
  useEffect(() => {
    if (authStatus !== 'authenticated' || userDetailsFetched) return;

    (async () => {
      try {
        const res = await fetch('/api/users/my-details');
        const data = await res.json();
        if (res.ok) {
          setOtherUserData(prev => ({
            ...prev,
            referralCode: data.referralCode ?? prev.referralCode,
            completedActions: data.completedActions ?? prev.completedActions,
            xUsername: data.xUsername ?? prev.xUsername,
            squadId: data.squadId ?? prev.squadId,
          }));
          if (data.points !== undefined && data.points !== null) {
            // points are handled by useUserAirdrop; leave untouched here
          }
          setUserDetailsFetched(true);
        }
      } catch (e) {
        console.warn('[HomePageLogic] Unable to fetch my-details:', e);
      }
    })();
  }, [authStatus, userDetailsFetched]);

  // Other effects: largely unchanged
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
      // console.log("[HomePage] Squad Invite ID from URL:", squadInviteParam);
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
      setOtherUserData({});      // Reset other user data
      setMySquadData(null);
      setHasSufficientDefai(null); 
      setPendingInvites([]);
      // userAirdrop hook will re-fetch due to publicKey change
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

  const handleFullLogout = useCallback(async () => {
    // console.log("[HomePageLogic] Initiating full logout...");
    toast.info("Signing out and disconnecting wallet...");

    // 1. Disconnect Solana Wallet
    if (wallet.connected) {
      try {
        await wallet.disconnect();
        // console.log("[HomePageLogic] Wallet disconnected.");
      } catch (e) {
        console.error("[HomePageLogic] Error disconnecting wallet:", e);
        toast.error("Failed to disconnect wallet.");
        // Decide if you want to proceed with NextAuth logout even if wallet disconnect fails
      }
    }

    // 2. Sign out from NextAuth
    try {
      // Redirect: false - we handle redirect manually after to ensure wallet is disconnected first
      // and to give time for state to clear before potential auto-re-login attempt by other effects.
      await nextAuthSignOut({ redirect: false, callbackUrl: '/' }); 
      // console.log("[HomePageLogic] NextAuth signOut successful.");

      // Clear local states that should reset on logout
      // This is crucial to prevent stale data from causing auto-login or incorrect UI states
      setOtherUserData({}); 
      setMySquadData(null);
      setUserCheckedNoSquad(false);
      setHasSufficientDefai(null);
      setPendingInvites([]);
      setDefaiBalance(null); 
      // userAirdrop.reset(); // If your useUserAirdrop hook has a reset function
      // Potentially reset other states like isRewardsActive, activationAttempted if they shouldn't persist after logout
      setIsRewardsActive(false); 
      setActivationAttempted(false); 
      setWalletSignInAttempted(false); // Allow re-attempt of wallet sign-in on next connection

      // 3. Redirect to home or login page
      // router.push('/'); // Redirect after state has been cleared and signOut processed
      // Forcing a full page reload can sometimes be more robust for clearing all states
      window.location.href = '/';

    } catch (e) {
      console.error("[HomePageLogic] Error during NextAuth signOut:", e);
      toast.error("Error signing out.");
    }
  }, [wallet, nextAuthSignOut, router, updateSession, setOtherUserData, setMySquadData, setUserCheckedNoSquad, setHasSufficientDefai, setPendingInvites, setDefaiBalance, setIsRewardsActive, setActivationAttempted, setWalletSignInAttempted]);

  // Effect to reset walletSignInAttempted when user becomes unauthenticated
  // This ensures that after a full logout, a new sign-in attempt can proceed.
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      // console.log("[HomePageLogic] Auth status is unauthenticated, resetting walletSignInAttempted.");
      setWalletSignInAttempted(false);
      // Also reset walletPromptedRef here to be absolutely sure the modal can show on a fresh attempt if needed
      // though the other effect should handle it based on authStatus.
      // walletPromptedRef.current = false; // Re-consider if this is needed or if other effect is sufficient
    }
  }, [authStatus]);

  // Effect that automatically prompts wallet connect modal
  useEffect(() => {
    const wasLoggingOut = sessionStorage.getItem('logoutInProgress') === 'true';
    if (wasLoggingOut) {
      sessionStorage.removeItem('logoutInProgress');
      if (typeof setWalletModalVisible === 'function') { setWalletModalVisible(false); }
      walletPromptedRef.current = true; 
      // console.log("[HomePageLogic WalletModalEffect] Logout flag processed. Modal hidden, further prompts suppressed for this page load.");
      return; 
    }
    if (authStatus === "authenticated" && !wallet.connected && !wallet.connecting && !walletPromptedRef.current) {
      // console.log("[HomePageLogic WalletModalEffect] Conditions met to show wallet modal (auth'd, not connected, not yet prompted).");
      walletPromptedRef.current = true;
      if (typeof setWalletModalVisible === 'function') { setTimeout(() => setWalletModalVisible(true), 100); }
       else { console.error("[HomePageLogic WalletModalEffect] setWalletModalVisible is not a function."); }
    }
    if (wallet.connected) {
        walletPromptedRef.current = false;
    } else if (authStatus === "unauthenticated" && !wasLoggingOut) { 
        walletPromptedRef.current = false;
    }
  }, [authStatus, wallet.connected, wallet.connecting, setWalletModalVisible]);

  // Auto NextAuth sign-in effect
  useEffect(() => {
    if (
      wallet.connected &&
      wallet.publicKey &&
      authStatus !== 'authenticated' && // This will be 'unauthenticated' for a new login attempt
      !isWalletSigningIn &&
      !walletSignInAttempted        // This should now be false after logout, allowing re-login
    ) {
      // console.log('[HomePageLogic AutoSignInEffect] Conditions met. Attempting NextAuth sign-in.');
      setIsWalletSigningIn(true);
      setWalletSignInAttempted(true); // Set to true before attempting
      const determinedChain = "solana"; 
      signIn('wallet', { 
        walletAddress: wallet.publicKey.toBase58(), 
        chain: determinedChain, 
        redirect: false 
      })
        .then(async (res) => {
          if (res?.ok) {
            await updateSession(); 
          } else { /* handle error/non-ok */ }
        })
        .catch((err) => { console.error('[HomePageLogic AutoSignInEffect] signIn exception:', err); })
        .finally(() => { setIsWalletSigningIn(false); });
    }
  }, [wallet.connected, wallet.publicKey, authStatus, isWalletSigningIn, walletSignInAttempted, updateSession]);

  // New useEffect to handle wallet disconnect triggering NextAuth sign out
  useEffect(() => {
    // console.log(`[HomePageLogic Disconnect Watcher] Running. Wallet Connected: ${wallet.connected}, Auth Status: ${authStatus}`);

    // Check if the wallet was previously connected and is now disconnected,
    // and if the user is currently authenticated with NextAuth.
    if (prevConnectedRef.current === true && !wallet.connected && authStatus === 'authenticated') {
      // console.log("[HomePageLogic Disconnect Watcher] Wallet disconnected while authenticated with NextAuth. Initiating full logout.");
      toast.info("Wallet disconnected. Signing out...");

      // Perform the NextAuth sign-out and redirect logic similar to AppHeader's handleFullSignOut
      (async () => {
        try {
          // Clear local states that should reset on logout (from useHomePageLogic context)
          setOtherUserData({}); 
          setMySquadData(null);
          setUserCheckedNoSquad(false);
          setHasSufficientDefai(null);
          setPendingInvites([]);
          setDefaiBalance(null); 
          setIsRewardsActive(false); 
          setActivationAttempted(false); 
          setWalletSignInAttempted(false); // Crucial for allowing re-login later
          walletPromptedRef.current = false; // Reset modal prompt state too
          // If useUserAirdrop hook has a reset, call it: userAirdrop.reset();

          // console.log("[HomePageLogic Disconnect Watcher] Local states cleared.");

          await nextAuthSignOut({ redirect: false });
          // console.log("[HomePageLogic Disconnect Watcher] NextAuth signOut successful. Setting logout flag and redirecting.");
          
          sessionStorage.setItem('logoutInProgress', 'true'); // Prevent modal on landing page
          router.push('/');

        } catch (e) {
          console.error("[HomePageLogic Disconnect Watcher] Error during NextAuth signOut or redirection:", e);
          toast.error("Error signing out after wallet disconnect.");
          // Fallback redirect
          window.location.href = '/'; 
        }
      })();
    }

    // Update the ref with the current connected state for the next run
    prevConnectedRef.current = wallet.connected;

  }, [wallet.connected, authStatus, router, nextAuthSignOut, /* include all state setters used for clearing */ setOtherUserData, setMySquadData, setUserCheckedNoSquad, setHasSufficientDefai, setPendingInvites, setDefaiBalance, setIsRewardsActive, setActivationAttempted, setWalletSignInAttempted]);

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
    setAirdropCheckResult: setAirdropCheckResultForTyped, // Keep prop name consistent if page.tsx uses it
    isCheckingAirdrop: isCheckingAirdropForTyped, // Renamed
    setIsCheckingAirdrop: setIsCheckingAirdropForTyped, // Keep prop name consistent
    
    isRewardsActive,
    isActivatingRewards,
    // setUserData, // This is now managed by setOtherUserData and userAirdrop hook
    setOtherUserData, // Expose if needed for direct updates of non-point/airdrop data
    
    mySquadData,
    isFetchingSquad,
    userCheckedNoSquad,
    initialReferrer,
    pendingInvites,
    isFetchingInvites,
    isProcessingInvite,
    setIsProcessingInvite,
    squadInviteIdFromUrl,
    setSquadInviteIdFromUrl,
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
    defaiBalance,
    setDefaiBalance,

    // Callbacks
    handleWalletConnectSuccess,
    fetchMySquadData,
    fetchPendingInvites,
    checkDefaiBalance,
    activateRewardsAndFetchData,
    handleFullLogout,
  };
} 