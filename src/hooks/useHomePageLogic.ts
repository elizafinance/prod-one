// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signIn, signOut as nextAuthSignOut } from "next-auth/react";
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
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
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const walletPromptedRef = useRef(false);

  const userAirdrop = useUserAirdrop();
  const [typedAddress, setTypedAddress] = useState('');
  const [airdropCheckResultForTyped, setAirdropCheckResultForTyped] = useState<number | string | null>(null);
  const [isCheckingAirdropForTyped, setIsCheckingAirdropForTyped] = useState(false);
  const [isRewardsActive, setIsRewardsActive] = useState(false);
  const [isActivatingRewards, setIsActivatingRewards] = useState(false);
  const [otherUserData, setOtherUserData] = useState<Partial<UserAirdropData & { referralCode?: string; completedActions?: string[]; xUsername?: string; squadId?: string }>>({});
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

  const combinedUserData = {
    ...otherUserData,
    points: userAirdrop.points,
    initialAirdropAmount: userAirdrop.initialDefai,
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

  const handleWalletConnectSuccess = useCallback(async () => {
    if (!wallet.publicKey || !session?.user?.xId) {
      return;
    }
    toast.info("Linking your wallet to your X account...");
    try {
      const response = await fetch('/api/users/link-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: wallet.publicKey.toBase58() }),
      });
      const data = await response.json();
      if (response.ok) {
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
    setIsFetchingSquad(true);
    try {
      const response = await fetch(`/api/squads/my-squad?userWalletAddress=${encodeURIComponent(userWalletAddress)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.squad) {
          setMySquadData(data.squad);
          setUserCheckedNoSquad(false);
        } else {
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
    if (!wallet.connected || !session || !session.user?.xId) {
        return;
    }
    if(isFetchingInvites) {
        return;
    }
    setIsFetchingInvites(true);
    try {
      const response = await fetch('/api/squads/invitations/my-pending');
      if (response.ok) {
        const data = await response.json();
        setPendingInvites(data.invitations || []);
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
        return;
    }
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

  useEffect(() => {
    if (
      authStatus === "authenticated" &&
      session?.user?.xId &&
      wallet.connected &&
      wallet.publicKey &&
      !session?.user?.walletAddress && 
      !isActivatingRewards 
    ) {
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
      checkDefaiBalance(wallet.publicKey, connection);
    } else if (
      authStatus === "authenticated" &&
      wallet.connected &&
      session?.user?.walletAddress &&
      isRewardsActive && 
      !isFetchingInvites 
    ) {
      fetchPendingInvites();
    }

    if (authStatus === "authenticated" && !wallet.connected && isRewardsActive) {
      setIsRewardsActive(false);
      setOtherUserData({}); 
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
    fetchMySquadData, 
    fetchPendingInvites,
    checkDefaiBalance,
    hasSufficientDefai,
    isCheckingDefaiBalance,
    isFetchingInvites,
    connection,
    userAirdrop.isLoading,
  ]);

  useEffect(() => {
    if (
      wallet.connected &&
      wallet.publicKey &&
      authStatus !== 'authenticated' &&
      !isWalletSigningIn &&
      !walletSignInAttempted
    ) {
      setIsWalletSigningIn(true);
      setWalletSignInAttempted(true);
      const determinedChain = "solana"; 
      signIn('wallet', { 
        walletAddress: wallet.publicKey.toBase58(), 
        chain: determinedChain, 
        redirect: false 
      })
        .then(async (res) => {
          if (res?.error) {
            console.error('[HomePageLogic] Wallet sign-in returned error:', res.error);
          } else if (res?.ok) {
            try {
              await updateSession(); 
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
          setUserDetailsFetched(true);
        }
      } catch (e) {
        console.warn('[HomePageLogic] Unable to fetch my-details:', e);
      }
    })();
  }, [authStatus, userDetailsFetched]);

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
      setOtherUserData({});      
      setMySquadData(null);
      setHasSufficientDefai(null); 
      setPendingInvites([]);
    }
  }, [wallet.connected, wallet.publicKey, prevWalletAddress]);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
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
    toast.info("Signing out and disconnecting wallet...");
    if (wallet.connected) {
      try {
        await wallet.disconnect();
      } catch (e) {
        console.error("[HomePageLogic] Error disconnecting wallet:", e);
        toast.error("Failed to disconnect wallet.");
      }
    }
    try {
      await nextAuthSignOut({ redirect: false, callbackUrl: '/' }); 
      setOtherUserData({}); 
      setMySquadData(null);
      setUserCheckedNoSquad(false);
      setHasSufficientDefai(null);
      setPendingInvites([]);
      setDefaiBalance(null); 
      setIsRewardsActive(false); 
      setActivationAttempted(false); 
      setWalletSignInAttempted(false);
      sessionStorage.setItem('logoutInProgress', 'true');
      window.location.href = '/';
    } catch (e) {
      console.error("[HomePageLogic] Error during NextAuth signOut:", e);
      toast.error("Error signing out.");
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
  }, [
    wallet, 
    nextAuthSignOut, 
    setOtherUserData, 
    setMySquadData, 
    setUserCheckedNoSquad, 
    setHasSufficientDefai, 
    setPendingInvites, 
    setDefaiBalance, 
    setIsRewardsActive, 
    setActivationAttempted, 
    setWalletSignInAttempted
  ]);

  useEffect(() => {
    if (authStatus === "unauthenticated") {
      setWalletSignInAttempted(false);
    }
  }, [authStatus]);

  useEffect(() => {
    const wasLoggingOut = sessionStorage.getItem('logoutInProgress') === 'true';
    if (wasLoggingOut) {
      sessionStorage.removeItem('logoutInProgress');
      if (typeof setWalletModalVisible === 'function') { setWalletModalVisible(false); }
      walletPromptedRef.current = true; 
      return; 
    }
    if (authStatus === "authenticated" && !wallet.connected && !wallet.connecting && !walletPromptedRef.current) {
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

  useEffect(() => {
    if (
      wallet.connected &&
      wallet.publicKey &&
      authStatus !== 'authenticated' && 
      !isWalletSigningIn &&
      !walletSignInAttempted        
    ) {
      setIsWalletSigningIn(true);
      setWalletSignInAttempted(true); 
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

  return {
    session,
    authStatus,
    wallet,
    connection,
    userAirdropData: userAirdrop,
    userData: combinedUserData,
    typedAddress,
    setTypedAddress,
    airdropCheckResultForTyped,
    setAirdropCheckResult: setAirdropCheckResultForTyped,
    isCheckingAirdrop: isCheckingAirdropForTyped,
    setIsCheckingAirdrop: setIsCheckingAirdropForTyped,
    isRewardsActive,
    isActivatingRewards,
    setOtherUserData,
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
    handleWalletConnectSuccess,
    fetchMySquadData,
    fetchPendingInvites,
    checkDefaiBalance,
    activateRewardsAndFetchData,
    handleFullLogout,
  };
} 