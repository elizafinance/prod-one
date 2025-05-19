// @ts-nocheck
"use client";

import { useEffect, useRef } from 'react';
import { useHomePageLogic } from '@/hooks/useHomePageLogic';
import SiteLogo from "@/assets/logos/favicon.ico"; // Using favicon as the main small logo
import Illustration from "@/assets/images/tits.png"; // The illustration
import Link from 'next/link'; // Already imported, but confirming it's here
import { toast } from 'sonner'; // Import sonner toast
import { useWallet } from '@solana/wallet-adapter-react'; // Import useWallet
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import dynamic from 'next/dynamic'; // Import dynamic
import { useSession, signIn, signOut } from "next-auth/react"; // NextAuth hooks
import { ReferralBoost, SquadDocument, SquadInvitationDocument } from '@/lib/mongodb'; // Import the ReferralBoost interface and SquadDocument
import { BellIcon } from '@heroicons/react/24/outline'; // Example icon, install @heroicons/react
import UserAvatar from "@/components/UserAvatar";
import { PublicKey, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { useRouter } from 'next/navigation';
import { useConnection } from '@solana/wallet-adapter-react';
import { checkRequiredEnvVars } from '@/utils/checkEnv';
import DeFAILogo from '@/components/DeFAILogo';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AirdropInfoDisplay from "@/components/airdrop/AirdropInfoDisplay";
import { AIR } from '@/config/points.config'; // Import AIR config
import { formatPoints } from '@/lib/utils'; // Import formatPoints
import AirdropSnapshotHorizontal from "@/components/dashboard/AirdropSnapshotHorizontal";
import DashboardActionRow from "@/components/layout/DashboardActionRow";
import MiniSquadCard from "@/components/dashboard/MiniSquadCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import TopProposalCard from "@/components/dashboard/TopProposalCard";
import SquadGoalQuestCard from "@/components/dashboard/SquadGoalQuestCard";
import { useUserAirdrop, UserAirdropData as UserAirdropHookData } from '@/hooks/useUserAirdrop'; // Explicitly import type

// Dynamically import WalletMultiButton
const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

// Icons for buttons (simple text for now, can be replaced with actual icons)
const HomeIcon = () => <span>🏠</span>;
const ChartIcon = () => <span>📊</span>;
const LeaderboardIcon = () => <span>🏆</span>;
const ProposalsIcon = () => <span>🗳️</span>;
const XIcon = () => <span>✖️</span>; // Using a different X icon for clarity
const TelegramIcon = () => <span>✈️</span>;
const ShareIcon = () => <span>🔗</span>; // For Share on X specific button

// Define activities for the points table display
const pointActivities = [
  { action: `Log in with X (First time)`, points: AIR.INITIAL_LOGIN, id: 'initial_connection' },
  { action: `Connect Wallet (First time)`, points: AIR.WALLET_CONNECT_FIRST_TIME, id: 'wallet_connected_first_time' },
  { action: `Share Your Profile on X (Earns Referral Boost!)`, pointsString: "🚀 Boost", points: AIR.PROFILE_SHARE_ON_X, id: 'shared_milestone_profile_on_x' }, // points for calculation, pointsString for display
  { action: `Share Airdrop Result on X`, points: AIR.AIRDROP_RESULT_SHARE_ON_X, id: 'shared_on_x' },
  { action: `Follow @DeFAIRewards on X`, points: AIR.FOLLOW_ON_X, id: 'followed_on_x' },
  { action: `Join DeFAIRewards Telegram`, points: AIR.JOIN_TELEGRAM, id: 'joined_telegram' },
  { action: `Refer a Friend (they connect wallet after X login)`, points: AIR.REFERRAL_BONUS_FOR_REFERRER, id: 'referral_bonus' },
  { action: `Airdrop Tier: Bronze (>10k ${AIR.LABEL})`, points: AIR.AIRDROP_TIER_BRONZE_POINTS, id: 'airdrop_tier_bronze' },
  { action: `Airdrop Tier: Silver (>100k ${AIR.LABEL})`, points: AIR.AIRDROP_TIER_SILVER_POINTS, id: 'airdrop_tier_silver' },
  { action: `Airdrop Tier: Gold (>1M ${AIR.LABEL})`, points: AIR.AIRDROP_TIER_GOLD_POINTS, id: 'airdrop_tier_gold' },
  { action: `Airdrop Tier: Diamond (>10M ${AIR.LABEL})`, points: AIR.AIRDROP_TIER_DIAMOND_POINTS, id: 'airdrop_tier_diamond' },
  { action: `Airdrop Tier: Master (>100M ${AIR.LABEL})`, points: AIR.AIRDROP_TIER_MASTER_POINTS, id: 'airdrop_tier_master' },
  { action: `Airdrop Tier: Grandmaster (>500M ${AIR.LABEL})`, points: AIR.AIRDROP_TIER_GRANDMASTER_POINTS, id: 'airdrop_tier_grandmaster' },
  { action: `Airdrop Tier: Legend (1B ${AIR.LABEL})`, points: AIR.AIRDROP_TIER_LEGEND_POINTS, id: 'airdrop_tier_legend' },
];

interface UserData {
  points: number | null;
  initialAirdropAmount?: number | null;
  referralCode?: string;
  completedActions?: string[];
  xUsername?: string;
  squadId?: string;
  activeReferralBoosts?: ReferralBoost[];
  referralsMadeCount?: number;
  highestAirdropTierLabel?: string;
  walletAddress?: string;
}

interface MySquadData extends SquadDocument {}

// Add an interface for the enriched squad invitation that includes inviter info
interface EnrichedSquadInvitation extends SquadInvitationDocument {
  inviterInfo?: {
    xUsername?: string;
    xProfileImageUrl?: string;
  }
}

const envRequiredDefaiAmount = process.env.NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT;
let REQUIRED_DEFAI_AMOUNT = envRequiredDefaiAmount ? parseInt(envRequiredDefaiAmount, 10) : 5000;

if (isNaN(REQUIRED_DEFAI_AMOUNT)) {
  console.warn(`Invalid NEXT_PUBLIC_REQUIRED_DEFAI_AMOUNT: "${envRequiredDefaiAmount}". Defaulting to 5000.`);
  REQUIRED_DEFAI_AMOUNT = 5000;
}

export default function HomePage() {
  console.log("[HomePage] Component Rendering/Re-rendering");

  const {
    // Auth & Wallet
    session,
    authStatus,
    wallet,
    connection,

    // State
    typedAddress,
    setTypedAddress,
    airdropCheckResultForTyped,
    setAirdropCheckResult,
    isCheckingAirdrop,
    setIsCheckingAirdrop,
    isRewardsActive,
    isActivatingRewards,
    userData,
    userAirdropData,
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
    setIsDesktop,
    totalCommunityPoints,
    defaiBalance,
    setDefaiBalance,

    // Callbacks
    handleWalletConnectSuccess,
    fetchMySquadData,
    fetchPendingInvites,
    checkDefaiBalance,
    activateRewardsAndFetchData,
  } = useHomePageLogic();

  // Access the wallet modal controller so we can open it programmatically
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const walletPromptedRef = useRef(false);

  const handleInitialAirdropCheck = async () => {
    const addressToCheck = typedAddress.trim();
    if (!addressToCheck) {
      toast.warning("Please enter a wallet address.");
      return;
    }
    setIsCheckingAirdrop(true);
    setAirdropCheckResult(null); 
    try {
      const response = await fetch(`/api/check-airdrop?address=${encodeURIComponent(addressToCheck)}`);
      let data: any;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { error: text };
      }
      if (response.ok) {
        setAirdropCheckResult(data.AIRDROP);
        if (typeof data.AIRDROP === 'number') {
            toast.success(`This address qualifies for ${formatPoints(data.AIRDROP)} ${AIR.LABEL}.`);
        } else {
            toast.info(data.error || "Airdrop status unknown.");
            setAirdropCheckResult("Eligibility status unclear.");
        }
      } else {
        if (data.error && data.error.toLowerCase().includes("don't qualify")) {
          setAirdropCheckResult(0);
          toast.info("This address isn't on the initial airdrop list.");
        } else {
          setAirdropCheckResult(data.error || "Airdrop status unknown.");
          toast.error(data.error || "Could not check airdrop status.");
        }
      }
    } catch (error) {
      toast.error("Failed to check airdrop status.");
      setAirdropCheckResult("Error checking status.");
    }
    setIsCheckingAirdrop(false);
  };
  
  const logSocialAction = async (actionType: 'shared_on_x' | 'followed_on_x' | 'joined_telegram') => {
    if (authStatus !== "authenticated" || !session?.user?.xId) {
      toast.error("Please log in with X first.");
      return;
    }
    // Wallet connection is not strictly required to log some social actions if they are tied to xID primarily,
    // but points update might rely on walletAddress being present in UserDocument.
    // For now, we proceed and the backend will handle it.

    toast.info(`Attempting to log ${actionType.replace('_',' ')}...`);
    try {
      const response = await fetch('/api/actions/log-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            xUserId: session.user.xId,
            walletAddress: wallet.publicKey?.toBase58(), // Send wallet if connected
            actionType 
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || `${actionType.replace('_',' ')} logged!`);
        if (data.newPointsTotal !== undefined && data.completedActions !== undefined) {
          setUserData(prev => {
            // Ensure prev is not null and spread its properties
            const base = prev || {}; 
            return {
                ...base,
                points: data.newPointsTotal, // Points might be part of 'otherUserData' or derived in combinedUserData
                completedActions: data.completedActions // This is the key update
            };
          });
        }
        // Optionally, refresh all userData if the backend doesn't return the full updated state
        // if(wallet.publicKey && session.user.xId && session.user.dbId) activateRewardsAndFetchData(wallet.publicKey.toBase58(), session.user.xId, session.user.dbId);

      } else {
        toast.error(data.error || `Failed to log ${actionType.replace('_',' ')} action.`);
      }
    } catch (error) {
      toast.error(`Error logging ${actionType.replace('_',' ')} action.`);
    }
  };

  const handleShareToX = () => {
    if (authStatus !== "authenticated" || !session?.user?.xId || !isRewardsActive) {
        toast.info("Log in with X and activate rewards to share.");
        return;
    }
    // Use the new state variable for the total airdrop amount for sharing
    if (currentTotalAirdropForSharing <= 0) {
        toast.info("You need to have a calculated airdrop amount to share."); // Updated message
        return;
    }
    const airdropAmountStr = currentTotalAirdropForSharing.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const siteBaseUrl = "https://squad.defairewards.net";
    const shareUrl = userData?.referralCode ? `${siteBaseUrl}/?ref=${userData.referralCode}` : siteBaseUrl;
    const twitterHandle = "DeFAIRewards";
    const tokenToBuy = "$DeFAI"; 
    const snapshotDate = "May 20, 2025";
    const text = `I'm getting ${airdropAmountStr} $DEFAI from @${twitterHandle} in the migration! 🚀 My referral link: ${shareUrl} \nGet ready for the ${snapshotDate} snapshot - buy ${tokenToBuy} now!`;
    const hashtags = "DeFAIRewards,Airdrop,AI,Solana";
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&hashtags=${encodeURIComponent(hashtags)}&via=${twitterHandle}`;
    window.open(twitterIntentUrl, '_blank');
    logSocialAction('shared_on_x');
  };
  
  const handleCopyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      toast.success("Referral link copied to clipboard!");
    }).catch(err => {
      toast.error("Failed to copy link.");
    });
  };

  const handleInviteAction = async (invitationId: string, action: 'accept' | 'decline') => {
    setIsProcessingInvite(invitationId);
    try {
      const response = await fetch(`/api/squads/invitations/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitationId }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || `Invitation ${action}ed successfully!`);
        fetchPendingInvites(); // Refresh invites list
        if (action === 'accept') {
          // If accepted, also refresh user data and their squad data as they've joined a squad
          if(wallet.publicKey && session?.user?.xId && session?.user?.dbId) {
            activateRewardsAndFetchData(wallet.publicKey.toBase58(), session.user.xId, session.user.dbId);
          }
        }
      } else {
        toast.error(data.error || `Failed to ${action} invitation.`);
      }
    } catch (err) {
      toast.error(`An error occurred while trying to ${action} the invitation.`);
      console.error(`Error ${action}ing invite:`, err);
    }
    setIsProcessingInvite(null);
  };

  // ---> Process squad invite link for already-authenticated users (no wallet needed)
  useEffect(() => {
    const shouldProcessInvite =
      authStatus === "authenticated" &&
      !!squadInviteIdFromUrl &&
      !wallet.connected && // activation flow handles wallet-connected case
      !isProcessingLinkInvite;

    if (!shouldProcessInvite) return;

    const processInvite = async () => {
      setIsProcessingLinkInvite(true);
      try {
        const res = await fetch("/api/squads/invitations/process-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ squadId: squadInviteIdFromUrl as string }),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(data.message || "Squad invitation received!");
          // Refresh pending invites so notification count updates
          fetchPendingInvites();
          setSquadInviteIdFromUrl(null); // prevent duplicate processing
        } else {
          console.warn("[HomePage] Process invite link error:", data.error || res.statusText);
        }
      } catch (err) {
        console.error("[HomePage] Failed to process squad invite link:", err);
      }
      setIsProcessingLinkInvite(false);
    };

    processInvite();
  }, [authStatus, squadInviteIdFromUrl, wallet.connected, isProcessingLinkInvite, fetchPendingInvites]);

  // Automatically prompt wallet connect modal right after X login
  useEffect(() => {
    if (
      authStatus === "authenticated" &&
      !wallet.connected &&
      !wallet.connecting &&
      !walletPromptedRef.current
    ) {
      walletPromptedRef.current = true;
      // Slight delay ensures modal provider is mounted
      setTimeout(() => setWalletModalVisible(true), 100);
    }
    if (wallet.connected) {
      walletPromptedRef.current = false; // reset for future logouts/logins
    }
  }, [authStatus, wallet.connected, wallet.connecting, setWalletModalVisible]);

  const airdropTokenSymbol = process.env.NEXT_PUBLIC_AIRDROP_TOKEN_SYMBOL || "AIR"; // Keep for one direct use or pass TOKEN_LABEL_AIR
  const snapshotDateString = process.env.NEXT_PUBLIC_AIRDROP_SNAPSHOT_DATE_STRING || "May 20th";
  const airdropPoolSize = parseInt(process.env.NEXT_PUBLIC_AIRDROP_POINTS_POOL_SIZE || '1000000000', 10);

  // Fetch totalCommunityPoints (example, adjust to your actual API)
  useEffect(() => {
    fetch('/api/stats/total-points')
      .then(async (res) => {
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Expected JSON – received: ${text.substring(0, 100)}...`);
        }
        return res.json();
      })
      .then(data => {
        if (data.totalCommunityPoints > 0 && typeof setTotalCommunityPoints === 'function') {
          setTotalCommunityPoints(data.totalCommunityPoints);
        }
      })
      .catch(err => console.error("Failed to fetch total community points for dashboard", err));
  }, []);

  // Fetch defaiBalance (example, adjust to your actual API/logic if not already in AirdropInfoDisplay a level up)
   useEffect(() => {
    if (wallet.connected && wallet.publicKey && connection) {
      const fetchBalance = async () => {
        const tokenMintAddress = process.env.NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS;
        const tokenDecimals = parseInt(process.env.NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS || '9', 10);
        if (tokenMintAddress) {
          try {
            const mint = new PublicKey(tokenMintAddress);
            const ata = await getAssociatedTokenAddress(mint, wallet.publicKey!);
            const accountInfo = await getAccount(connection, ata, 'confirmed');
            setDefaiBalance(Number(accountInfo.amount) / (10 ** tokenDecimals));
          } catch (e) {
            console.warn("Could not fetch DeFAI balance for dashboard snapshot", e);
            setDefaiBalance(0); // Assume 0 if not found or error
          }
        }
      };
      fetchBalance();
    }
  }, [wallet.connected, wallet.publicKey, connection]);

  if (authStatus === "loading") {
    console.log("[HomePage] Rendering: Loading Session state");
    return <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-foreground"><p className="font-orbitron text-xl">Loading Session...</p></main>;
  }

  if (authStatus !== "authenticated") {
    console.log("[HomePage] Rendering: Not Authenticated state");
    return (
      <main className="flex flex-col lg:flex-row min-h-screen w-full">
        {/* Hero illustration on mobile should not be cropped */}
        <div className="relative lg:w-1/2 w-full overflow-hidden">
          {/* Use object-contain so the full image is visible, and let the image decide its own height */}
          <img
            src={Illustration.src}
            alt="Futuristic AI illustration"
            className="w-full h-auto object-contain animate-float"
          />
        </div>

        {/* Right login panel */}
        <div className="flex flex-col justify-center items-center lg:w-1/2 w-full bg-gradient-to-b from-black to-[#111] text-white px-8 py-12 space-y-8">
          <DeFAILogo className="h-16 w-16" />
          <h1 className="text-4xl md:text-5xl font-orbitron font-bold text-center">Welcome to DEFAI Rewards</h1>
          <p className="text-base md:text-lg text-center max-w-sm">Sign in with X to start earning rewards.</p>
          <div className="flex gap-4 w-full max-w-xs">
            <button
              onClick={() => signIn('twitter')}
              className="flex-1 bg-[#2563EB] hover:bg-[#1e54c7] text-white py-3 rounded-full font-medium transition-colors"
            >
              Login with X
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!session?.user?.walletAddress) {
    console.log("[HomePage] Rendering: X Authenticated, Wallet Not Linked in Session state");
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-foreground text-center">
        <DeFAILogo className="h-20 w-20 mb-6" />
        <h1 className="text-3xl font-bold text-primary mb-4 font-orbitron">Almost There!</h1>
        <p className="text-lg mb-6">Your X account is authenticated. Now, please connect your wallet to activate your DEFAI Rewards account.</p>
        <p className="text-sm text-muted-foreground">The Connect Wallet button is in the header.</p>
        {wallet.connecting && <p className="text-primary mt-4">Connecting to wallet...</p>}
      </main>
    );
  }
  
  console.log("[HomePage] Rendering: Fully Authenticated and Wallet Linked state");
  // Determine if points/actions section should be shown
  const showPointsSection = authStatus === "authenticated" && wallet.connected && isRewardsActive && userData && hasSufficientDefai === true;
  // Determine if the "Insufficient Balance" message should be shown
  const showInsufficientBalanceMessage = authStatus === "authenticated" && wallet.connected && isRewardsActive && userData && hasSufficientDefai === false;

  return (
    <main className="flex flex-col items-center min-h-screen bg-background text-foreground font-sans">
      {/* Header takes full width, AppHeader is sticky */}
      {/* Added pt-16 (or h-16 from header) to main content area if AppHeader isn't setting body padding */}
      <div className="w-full pt-16 md:pt-20"> 

        {/* Desktop Layout (≥ lg) */}
        {isDesktop ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 xl:gap-8">
              {/* === Left Column === */}
              <div className="flex flex-col space-y-6 animate-fadeUp">
                {/* Hero Headlines */}
                <div className="relative text-center lg:text-left">
                  <div className="flex items-center align-left gap-3">
                    <div className="relative">
                      <div className="text-center">
                        <h1 className="font-orbitron text-5xl sm:text-6xl font-bold text-[#2563EB]">
                          Banking AI Agents
                        </h1>
                        <h2 className="font-orbitron text-5xl sm:text-6xl font-bold text-black">
                          Rewarding Humans
                        </h2>
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-muted-foreground max-w-xl mx-auto lg:mx-0 font-sans">
                    Welcome to DEFAI Rewards. Check eligibility, activate your account, complete actions to earn {AIR.LABEL}, and climb the leaderboard!
                  </p>
                
                </div>

                {/* Action Buttons Row */}
                <DashboardActionRow 
                  isRewardsActive={isRewardsActive}
                  currentTotalAirdropForSharing={currentTotalAirdropForSharing}
                  onShareToX={handleShareToX}
                  onLogSocialAction={logSocialAction}
                  completedActions={userData?.completedActions || []}
                />

                {/* Airdrop Snapshot Horizontal */}
                {(authStatus === "authenticated" && wallet.connected && isRewardsActive && userData && hasSufficientDefai === true) && (
                  <AirdropSnapshotHorizontal 
                    initialAirdropAllocation={userData.initialAirdropAmount ?? null}
                    defaiBalance={defaiBalance} 
                    userPoints={userData.points ?? null}
                    totalCommunityPoints={totalCommunityPoints} 
                    airdropPoolSize={airdropPoolSize}
                    snapshotDateString={snapshotDateString}
                    isLoading={isActivatingRewards || isCheckingDefaiBalance} 
                  />
                )}
                 {(authStatus !== "authenticated" || !wallet.connected || !isRewardsActive || hasSufficientDefai === false) && (
                  <div className="p-6 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50 text-center">
                    <h3 className="text-xl font-semibold mb-2">Activate Your Account</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Connect your X account and wallet, and ensure you hold enough DEFAI to see your full airdrop snapshot and earn {AIR.LABEL}.
                    </p>
                    {/* Consider adding a primary CTA button here if appropriate */}
                  </div>
                )}

                {/* Milestones / Earn Actions Table (Accordion for Desktop) */}
                {showPointsSection && userData && (
                  <Accordion type="single" collapsible className="w-full bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50 p-1 md:p-2">
                    <AccordionItem value="item-1">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <h3 className="text-lg font-semibold text-foreground">How to Earn More {AIR.LABEL}</h3>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <ul className="space-y-1.5">
                          {pointActivities.map((activity) => {
                            const isCompleted = (userData.completedActions || []).includes(activity.id);
                            let isEffectivelyCompleted = isCompleted;
                            if (activity.id === 'shared_milestone_profile_on_x') {
                              const hasFrenzyBoost = userData.activeReferralBoosts?.some(b => b.description.includes('Referral Frenzy'));
                              isEffectivelyCompleted = isCompleted || !!hasFrenzyBoost;
                            }
                            return (
                              <li key={activity.id} className="flex justify-between items-center py-1.5 border-b border-border/50 last:border-b-0">
                                <span className={`text-sm ${isEffectivelyCompleted ? 'text-muted-foreground' : 'text-foreground'}`}>
                                  {isEffectivelyCompleted ? '✅ ' : '✨ '}
                                  {activity.action}
                                </span>
                                <span className={`font-semibold text-sm ${isEffectivelyCompleted ? 'text-muted-foreground' : (typeof activity.points === 'number' ? 'text-purple-600' : 'text-yellow-500')}`}>
                                  {activity.pointsString ? activity.pointsString : `${formatPoints(activity.points)} ${AIR.LABEL}`}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
              </div>

              {/* === Right Column (Sidebar) === */}
              <aside className="lg:sticky lg:top-24 space-y-6 animate-fadeUp lg:animate-[fadeUp_0.6s_ease_0.2s]" style={{alignSelf: 'start'}}>
                <MiniSquadCard 
                  squadId={mySquadData?.squadId}
                  squadName={mySquadData?.name}
                  totalSquadPoints={mySquadData?.totalSquadPoints}
                  memberCount={mySquadData?.memberWalletAddresses.length}
                  maxMembers={mySquadData?.maxMembers}
                  isLeader={mySquadData?.leaderWalletAddress === wallet.publicKey?.toBase58()}
                  isLoading={isFetchingSquad}
                />
                {isRewardsActive && mySquadData && (
                  <>
                    <TopProposalCard />
                    <SquadGoalQuestCard />
                  </>
                )}
                
                {isRewardsActive && userData?.referralCode && (
                  <div className="p-4 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50">
                    <div className="flex justify-between items-center mb-1.5">
                      <h3 className="text-md font-semibold text-foreground">Referral Link</h3>
                      {userData.activeReferralBoosts && userData.activeReferralBoosts.length > 0 && (
                        <span className="px-2 py-0.5 text-xs font-bold text-black bg-yellow-400 rounded-full animate-pulse shadow-sm">
                          BOOST ACTIVE!
                        </span>
                      )}
                    </div>
                    <div className="flex items-center bg-muted/50 p-1.5 rounded-md border border-input">
                      <input type="text" readOnly value={`https://squad.defairewards.net/?ref=${userData.referralCode}`} className="text-foreground text-xs break-all bg-transparent outline-none flex-grow p-1" />
                      <button onClick={() => handleCopyToClipboard(`https://squad.defairewards.net/?ref=${userData.referralCode}`)} className="ml-2 py-1 px-2 text-xs bg-[#2563EB] text-white rounded hover:bg-blue-700 transition-colors">
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                {isRewardsActive && !mySquadData && pendingInvites.length > 0 && (
                  <div className="p-4 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50 max-h-[300px] overflow-y-auto">
                    <h3 className="text-md font-semibold text-foreground mb-2">Squad Invitations</h3>
                    {isFetchingInvites && <p className="text-sm text-muted-foreground">Loading invites...</p>}
                    <ul className="space-y-2.5">
                      {pendingInvites.map(invite => (
                        <li key={invite.invitationId} className="p-2.5 bg-muted/50 rounded-lg shadow-sm border border-border">
                          <div className="flex items-center gap-2 mb-1.5">
                            <UserAvatar profileImageUrl={invite.inviterInfo?.xProfileImageUrl} username={invite.inviterInfo?.xUsername} size="sm" />
                            <div>
                              <p className="text-xs text-foreground">
                                Invite to <strong className="text-indigo-600">{invite.squadName}</strong>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                From: {invite.inviterInfo?.xUsername ? `@${invite.inviterInfo.xUsername}` : `${invite.invitedByUserWalletAddress.substring(0,6)}...`}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-1.5">
                            <Button size="sm" variant="outline" onClick={() => handleInviteAction(invite.invitationId, 'accept')} disabled={isProcessingInvite === invite.invitationId} className="flex-1 h-7 text-xs">
                              {isProcessingInvite === invite.invitationId ? '...' : 'Accept'} 
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleInviteAction(invite.invitationId, 'decline')} disabled={isProcessingInvite === invite.invitationId} className="flex-1 h-7 text-xs">
                              {isProcessingInvite === invite.invitationId ? '...' : 'Decline'}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </aside>
            </div>
          </div>
        ) : (
          // Mobile Layout (Existing Structure, but using AppHeader)
          <div className="w-full max-w-3xl mx-auto px-4 pt-2 pb-8 flex flex-col items-center">
            {/* Illustration and Headlines for Mobile (can be simpler or same as desktop) */}
            <div className="relative text-center mt-4 mb-6">
              <div className="text-center mb-6 mt-4">
                <h1 className="relative z-10 font-orbitron text-4xl font-bold text-[#2563EB]">
                  Banking AI Agents
                </h1>
                <h2 className="relative z-10 font-orbitron text-4xl font-bold text-black">
                  Rewarding Humans
                </h2>
              </div>
              <p className="relative z-10 mt-3 text-sm text-muted-foreground max-w-md mx-auto font-sans">
                Welcome to DEFAI Rewards. Check eligibility, activate your account, complete actions to earn {AIR.LABEL}, and climb the leaderboard!
              </p>
            </div>
            
            {/* Original Airdrop Checker for non-authed/non-active users on mobile */}
            {authStatus !== "authenticated" || !isRewardsActive || !wallet.connected ? (
              <div className="w-full mb-6">
                <div className="relative flex items-center mt-1 mb-4">
                  <input
                    type="text" value={typedAddress} onChange={(e) => setTypedAddress(e.target.value)}
                    placeholder="Enter Solana address for eligibility check"
                    className="w-full p-3 pl-4 pr-28 bg-card border border-input rounded-full focus:ring-1 focus:ring-[#2B96F1] text-sm"
                    disabled={isCheckingAirdrop}
                  />
                  <button
                    onClick={handleInitialAirdropCheck} disabled={isCheckingAirdrop}
                    className="absolute right-1.5 bg-[#2B96F1] hover:bg-blue-500 text-white font-medium py-1.5 px-4 rounded-full text-xs transition-all disabled:opacity-60"
                  >
                    {isCheckingAirdrop ? '...' : 'Check'}
                  </button>
                </div>
                {airdropCheckResultForTyped !== null && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center text-sm shadow-sm">
                    {typeof airdropCheckResultForTyped === 'number' ? (
                        airdropCheckResultForTyped > 0 ? (
                          <p>Eligible: <span className="font-bold text-green-600">{formatPoints(airdropCheckResultForTyped)} {AIR.LABEL}</span>!</p>
                        ) : (
                          <p className="text-muted-foreground">Not on initial list. Earn {AIR.LABEL} for future rewards!</p>
                        )
                      ) : (
                        <p className="text-red-600">{airdropCheckResultForTyped}</p>
                      )
                    }
                  </div>
                )}
              </div>
            ) : null}
            
            {/* Existing Content Flow for Mobile when rewards active */}
            {showInsufficientBalanceMessage && (
                <div className="w-full my-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-center shadow-sm">
                    <h3 className="text-md font-semibold text-blue-700 mb-2">Hold DeFAI Tokens</h3>
                    <p className="text-xs text-foreground mb-3">
                    To earn {AIR.LABEL}, hold {REQUIRED_DEFAI_AMOUNT} $DeFAI in wallet ({wallet.publicKey?.toBase58().substring(0,4)}...). 
                    </p>
                    <Link href="https://dexscreener.com/solana/3jiwexdwzxjva2yd8aherfsrn7a97qbwmdz8i4q6mh7y" target="_blank" rel="noopener noreferrer" className="inline-block">
                        <Button size="sm" className="bg-[#2B96F1] hover:bg-blue-600 text-white"><ChartIcon /> Buy DeFAI</Button>
                    </Link>
                </div>
            )}

            {showPointsSection && userData && (
              <div className="w-full max-w-md mt-1 flex flex-col items-center space-y-5">
                <AirdropInfoDisplay onTotalAirdropChange={setCurrentTotalAirdropForSharing} showTitle={false} />
                <DashboardActionRow 
                  isRewardsActive={isRewardsActive}
                  currentTotalAirdropForSharing={currentTotalAirdropForSharing}
                  onShareToX={handleShareToX}
                  onLogSocialAction={logSocialAction}
                  completedActions={userData?.completedActions || []}
                />
                <MiniSquadCard 
                  squadId={mySquadData?.squadId}
                  squadName={mySquadData?.name}
                  totalSquadPoints={mySquadData?.totalSquadPoints}
                  memberCount={mySquadData?.memberWalletAddresses.length}
                  maxMembers={mySquadData?.maxMembers}
                  isLeader={mySquadData?.leaderWalletAddress === wallet.publicKey?.toBase58()}
                  isLoading={isFetchingSquad}
                />
                {isRewardsActive && mySquadData && (
                  <div className="w-full space-y-4 mt-4">
                    <TopProposalCard />
                    <SquadGoalQuestCard />
                  </div>
                )}
                {/* Other mobile sections like referral, invites can be added here if needed, or kept simpler */}
                 {userData.referralCode && (
                  <div className="my-3 p-3 bg-card rounded-lg text-center w-full border border-border">
                    <p className="text-sm font-semibold text-foreground mb-1">Your Referral Link:</p>
                    <div className="flex items-center bg-muted p-1.5 rounded border border-input">
                      <input type="text" readOnly value={`https://squad.defairewards.net/?ref=${userData.referralCode}`} className="text-foreground text-xs break-all bg-transparent outline-none flex-grow p-0.5" />
                      <button onClick={() => handleCopyToClipboard(`https://squad.defairewards.net/?ref=${userData.referralCode}`)} className="ml-1.5 py-1 px-1.5 text-xs bg-[#2563EB] text-white rounded hover:bg-blue-700">
                        Copy
                      </button>
                    </div>
                  </div>
                )}
                <div className="w-full mt-3">
                    <h3 className="text-lg font-semibold text-foreground mb-2 text-center">How to Earn More {AIR.LABEL}</h3>
                    <div className="bg-card p-2.5 rounded-lg shadow border border-border">
                        <ul className="space-y-1">
                        {pointActivities.map((activity) => {
                            const isCompleted = (userData.completedActions || []).includes(activity.id);
                            let isEffectivelyCompleted = isCompleted;
                            if (activity.id === 'shared_milestone_profile_on_x') {
                            const hasFrenzyBoost = userData.activeReferralBoosts?.some(b => b.description.includes('Referral Frenzy'));
                            isEffectivelyCompleted = isCompleted || !!hasFrenzyBoost;
                            }
                            return (
                            <li key={activity.id} className="flex justify-between items-center py-1 border-b border-border/30 last:border-b-0">
                                <span className={`text-xs ${isEffectivelyCompleted ? 'text-muted-foreground' : 'text-foreground'}`}>
                                {isEffectivelyCompleted ? '✅ ' : '✨ '}
                                {activity.action}
                                </span>
                                <span className={`font-semibold text-xs ${isEffectivelyCompleted ? 'text-muted-foreground' : (typeof activity.points === 'number' ? 'text-purple-600' : 'text-yellow-500')}`}>
                                {activity.pointsString ? activity.pointsString : `${formatPoints(activity.points)} ${AIR.LABEL}`}
                                </span>
                            </li>
                            );
                        })}
                        </ul>
                    </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Bottom branding - remains same */}
      <div className="fixed bottom-0 w-full flex justify-center p-2 z-20 pointer-events-none">
        <div className="bg-black text-green-400 rounded-lg px-3 py-1 text-xs font-medium shadow-lg pointer-events-auto">
          Built with ElizaOS
        </div>
      </div>

      {/* Welcome Modal - remains same */}
      <Dialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal}>
        <DialogContent className="sm:max-w-[525px] bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 border-purple-300 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold font-spacegrotesk text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 animate-pulse">
              Squad Goals! Welcome to defAIRewards!
            </DialogTitle>
            <DialogDescription className="text-center text-foreground pt-2">
              You have successfully activated your account. Here is how to get started:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 text-sm text-foreground">
            <p>✨ <span className="font-semibold">Earn {AIR.LABEL}:</span> Connect your wallet, follow us on X, join Telegram, and share your profile/airdrop results to earn DeFAI {AIR.LABEL}.</p>
            <p>🚀 <span className="font-semibold">Refer Friends:</span> Share your unique referral link! You earn points when your friends connect their wallet after logging in via your link.</p>
            <p>🛡️ <span className="font-semibold">Join Squads:</span> Team up with others in Squads to boost your points potential and compete on the leaderboard.</p>
            <p>💰 <span className="font-semibold">Check Airdrop:</span> Use the checker to see if your wallet is eligible for the $AIR token airdrop.</p>
            <p>💎 <span className="font-semibold">Hold $DeFAI:</span> You need to hold at least {REQUIRED_DEFAI_AMOUNT} $DeFAI tokens in your connected wallet to earn points and use all features.</p>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => {
                 setShowWelcomeModal(false);
                 // TODO: Trigger tutorial start here if desired
                 console.log("[WelcomeModal] Closed. Tutorial trigger point.");
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              LFG!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
