"use client";

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useHomePageLogic } from '@/hooks/useHomePageLogic';
import Link from 'next/link'; // Already imported, but confirming it's here
import { toast } from 'sonner'; // Import sonner toast
import { useWallet } from '@solana/wallet-adapter-react'; // Import useWallet
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import dynamic from 'next/dynamic'; // Import dynamic
import { useSession, signIn, signOut } from "next-auth/react"; // NextAuth hooks
import { ReferralBoost, SquadDocument, SquadInvitationDocument } from '@/lib/mongodb'; // Import the ReferralBoost interface and SquadDocument
import UserAvatar from "@/components/UserAvatar";
import { PublicKey, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { useConnection } from '@solana/wallet-adapter-react';
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
import OnboardingStepper from '@/components/onboarding/Stepper'; // Import the stepper
import Image from 'next/image'; // Import next/image
import DashboardCard from "@/components/dashboard/DashboardCard"; // Import DashboardCard
import SquadInvitationCard from "@/components/squads/SquadInvitationCard";
import MilestoneTimeline, { Milestone } from "@/components/dashboard/MilestoneTimeline"; // Import MilestoneTimeline and Milestone type
import { CheckCircleIcon, ShareIcon, UserGroupIcon, UsersIcon } from '@heroicons/react/24/outline'; // Example, adjust as needed
import PullToRefresh from 'react-pull-to-refresh'; // Added PullToRefresh import
import Illustration from "@/assets/images/tits.png"; // Re-importing for onboarding
import ClientBoundary from '@/components/ClientBoundary';
import { AirdropSnapshotHorizontalProps } from '@/components/airdrop/AirdropSnapshotHorizontal';

// Dynamically import WalletMultiButton
const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

const PullToRefreshDynamic = dynamic(() => import('react-pull-to-refresh'), { ssr: false });

// Icons for buttons (simple text for now, can be replaced with actual icons)
const HomeIcon = () => <span>🏠</span>;
const ChartIcon = () => <span>📊</span>;
const LeaderboardIcon = () => <span>🏆</span>;
const ProposalsIcon = () => <span>🗳️</span>;
const TelegramIcon = () => <span>✈️</span>;

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

// Sample Milestones Data (derived from pointActivities or new campaign milestones)
const sampleMilestonesData: Milestone[] = [
  {
    id: 'login_and_wallet',
    title: "Account Activated",
    description: "Successfully logged in with X and connected your wallet.",
    points: AIR.INITIAL_LOGIN + AIR.WALLET_CONNECT_FIRST_TIME,
    pctComplete: 100, // This would be dynamic based on userData
    achievedAt: new Date(), // This would be dynamic
    icon: CheckCircleIcon, // Assuming CheckCircleIcon is imported or defined
  },
  {
    id: 'profile_share',
    title: "Share Your Profile",
    description: `Share your DeFAI Rewards profile on X to earn a referral boost and ${AIR.PROFILE_SHARE_ON_X} ${AIR.LABEL}.`,
    points: AIR.PROFILE_SHARE_ON_X,
    pctComplete: 0, // This would be dynamic
    actionUrl: '#', // Placeholder, would trigger share action
    icon: ShareIcon, // Assuming ShareIcon is imported or defined
  },
  {
    id: 'follow_community',
    title: "Join the Community",
    description: `Follow @DeFAIRewards on X and join the Telegram group. Earn ${AIR.FOLLOW_ON_X + AIR.JOIN_TELEGRAM} ${AIR.LABEL}.`,
    points: AIR.FOLLOW_ON_X + AIR.JOIN_TELEGRAM,
    pctComplete: 0, // This would be dynamic
    actionUrl: '#', // Placeholder, could link to a page with both links or trigger actions
    icon: UserGroupIcon, // Assuming UserGroupIcon is imported or defined
  },
  {
    id: 'first_referral',
    title: "Make Your First Referral",
    description: `Invite a friend who successfully activates their account. Earn ${AIR.REFERRAL_BONUS_FOR_REFERRER} ${AIR.LABEL}.`,
    points: AIR.REFERRAL_BONUS_FOR_REFERRER,
    pctComplete: 0, // This would be dynamic
    icon: UsersIcon, // Assuming UsersIcon or similar for referral
  },
];

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
  activeReferralBoosts?: Array<{
    id: string;
    expiresAt: string;
    multiplier: number;
  }>;
}

interface MySquadData extends SquadDocument {}

// Add an interface for the enriched squad invitation that includes inviter info
export interface EnrichedSquadInvitation extends SquadInvitationDocument {
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

interface OnboardingStepperProps {
  currentMajorStep: Step;
  onLogin: () => void;
  onConnectWallet: () => void;
  isWalletConnected: boolean;
}

type Step = 'login' | 'wallet' | 'rewards_active';

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
    mySquadData,
    isFetchingSquad,
    pendingInvites,
    isFetchingInvites,
    isProcessingInvite,
    setIsProcessingInvite,
    currentTotalAirdropForSharing,
    setCurrentTotalAirdropForSharing,
    isCheckingDefaiBalance,
    hasSufficientDefai,
    showWelcomeModal,
    setShowWelcomeModal,
    isDesktop,
    totalCommunityPoints,
    setTotalCommunityPoints,
    defaiBalance,
    setDefaiBalance,

    // Callbacks
    fetchMySquadData,
    fetchPendingInvites,
    activateRewardsAndFetchData,
  } = useHomePageLogic();

  // Access the wallet modal controller so we can open it programmatically
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const walletPromptedRef = useRef(false);

  // Define step types
  const stepMap: Record<number, Step> = {
    0: 'login',
    1: 'wallet',
    2: 'rewards_active'
  };

  // Move currentMajorStep declaration before useEffect
  const currentMajorStepNumber = authStatus === "authenticated" ? (wallet.connected ? 2 : 1) : 0;
  const currentMajorStep = stepMap[currentMajorStepNumber];

  useEffect(() => {
    if (!walletPromptedRef.current && authStatus === "authenticated" && !wallet.connected && !wallet.connecting && currentMajorStepNumber === 1) {
      setWalletModalVisible(true);
      walletPromptedRef.current = true;
    } else if (wallet.connected || wallet.connecting) {
      walletPromptedRef.current = false;
    }
  }, [authStatus, wallet.connected, wallet.connecting, setWalletModalVisible, currentMajorStepNumber]);

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
        if(data.newPointsTotal !== undefined && userData) {
          // setUserData(prev => prev ? {...prev, points: data.newPointsTotal, completedActions: [...(prev.completedActions || []), actionType] } : null);
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
    const text = `I'm getting ${airdropAmountStr} $AIR from @${twitterHandle}! 🚀 My referral link: ${shareUrl} \nGet ready for the ${snapshotDate} snapshot - buy ${tokenToBuy} now!`;
    const hashtags = "DeFAIRewards,Airdrop,AI,Solana";
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&hashtags=${encodeURIComponent(hashtags)}&via=${twitterHandle}`;
    if (typeof window !== 'undefined') {
      window.open(twitterIntentUrl, '_blank');
    }
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
  }, [setTotalCommunityPoints]);

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
  }, [wallet.connected, wallet.publicKey, connection, setDefaiBalance]);

  const handleRefresh = useCallback(async () => {
    if (!session?.user?.xId || !session?.user?.dbId || !wallet.publicKey) {
      toast.error("Please ensure you are logged in and your wallet is connected.");
      return;
    }

    try {
      // Re-fetch all primary dashboard data
      await activateRewardsAndFetchData(wallet.publicKey.toBase58(), session.user.xId, session.user.dbId);
      toast.success("Dashboard refreshed!");
    } catch (error) {
      console.error("[HomePage] Error during refresh:", error);
      toast.error("Failed to refresh dashboard data.");
    }
  }, [session, wallet.publicKey, activateRewardsAndFetchData]);

  // Safe wallet.publicKey access with null check
  const walletPublicKey = useMemo(() => {
    if (!wallet.publicKey) return null;
    try {
      const pubKey = new PublicKey(wallet.publicKey.toBase58());
      return pubKey;
    } catch {
      return null;
    }
  }, [wallet.publicKey]);

  const walletAddress = useMemo(() => walletPublicKey?.toBase58() ?? '', [walletPublicKey]);
  const truncatedWalletAddress = useMemo(() => 
    walletAddress ? `${walletAddress.substring(0,4)}...${walletAddress.substring(walletAddress.length - 4)}` : '', 
    [walletAddress]
  );

  // Type-safe error handling
  const handleShareError = (error: unknown) => {
    if (error instanceof Error) {
      if (error.name !== 'AbortError') {
        toast.error("Could not share link.");
        console.error("Error sharing referral link:", error);
      }
    }
  };

  // Type-safe share handler
  const handleShare = async () => {
    if (!userData?.referralCode) return;
    try {
      await navigator.share({
        title: 'Join me on DeFAI Rewards!',
        text: `Join me on DeFAI Rewards and let\'s earn together! Use my referral link:`,
        url: `https://squad.defairewards.net/?ref=${userData.referralCode}`
      });
      toast.success("Referral link shared!");
    } catch (error) {
      handleShareError(error);
    }
  };

  // Check if share API is available
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  // Type-safe copy handler
  const handleCopy = () => {
    if (!userData?.referralCode) return;
    handleCopyToClipboard(`https://squad.defairewards.net/?ref=${userData.referralCode}`);
  };

  // Type guard for UserData
  const isUserData = (data: unknown): data is UserData => {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    return 'points' in d && 
      'initialAirdropAmount' in d &&
      (!('activeReferralBoosts' in d) || (Array.isArray(d.activeReferralBoosts) && d.activeReferralBoosts.every(
        (boost: unknown) => typeof boost === 'object' && boost !== null &&
          'id' in boost && typeof (boost as any).id === 'string' &&
          'expiresAt' in boost && typeof (boost as any).expiresAt === 'string' &&
          'multiplier' in boost && typeof (boost as any).multiplier === 'number'
      )));
  };

  // Prepare AirdropSnapshotHorizontal props
  const airdropSnapshotProps: AirdropSnapshotHorizontalProps | null = userData ? {
    initialAirdropAllocation: userData.initialAirdropAmount,
    defaiBalance,
    userPoints: userData.points,
    totalCommunityPoints,
    airdropPoolSize,
    snapshotDateString,
    isLoading: isActivatingRewards || isCheckingDefaiBalance
  } : null;

  if (authStatus === "loading") {
    console.log("[HomePage] Rendering: Loading Session state");
    return <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-foreground"><p className="font-orbitron text-xl">Loading Session...</p></main>;
  }

  // Onboarding States: Render Stepper UI if not fully rewards_active
  if (currentMajorStep !== 'rewards_active') {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 bg-background text-foreground">
        <Image 
          src={Illustration} // Assuming Illustration is an imported image object from next/image or similar
          alt="DeFAI Onboarding Illustration" 
          width={240} // Provide explicit width for non-fill
          height={240} // Provide explicit height for non-fill
          className="mb-6 rounded-lg shadow-xl object-contain" // Removed w-X h-X, let width/height props control size ratio
          priority
        /> 
        <div className="flex flex-col items-center mb-8 text-center">
          <DeFAILogo className="h-16 w-16 sm:h-20 sm:w-20 mb-4" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-orbitron font-bold">Welcome to DeFAI Rewards</h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-xs sm:max-w-sm mt-2">Complete these steps to activate your account and start earning.</p>
        </div>
        <OnboardingStepper 
          currentMajorStep={currentMajorStep}
          onLogin={() => signIn('twitter')} 
          onConnectWallet={() => setWalletModalVisible(true)}
          isWalletConnected={wallet.connected}
        />
        {currentMajorStep === 'wallet' && wallet.connected && !isRewardsActive && (
          <div className="mt-6 flex flex-col items-center space-y-2 text-center">
            <p className="text-sm text-positive">Wallet connected: {truncatedWalletAddress}</p>
            <p className="text-sm text-muted-foreground">Finalizing account activation...</p>
            {isActivatingRewards && <p className="text-primary text-sm animate-pulse">Activating rewards...</p>}
          </div>
        )}
      </main>
    );
  }
  
  // ----- Authenticated and Rewards Active State (Main Dashboard) -----
  console.log("[HomePage] Rendering: Fully Authenticated and Wallet Linked state (Rewards Active)");
  const showPointsSection = authStatus === "authenticated" && wallet.connected && isRewardsActive && userData && hasSufficientDefai === true;
  const showInsufficientBalanceMessage = authStatus === "authenticated" && wallet.connected && isRewardsActive && userData && hasSufficientDefai === false;
    
  return (
    <ClientBoundary fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-center">
          <DeFAILogo className="w-24 h-24 mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Loading DeFAI Rewards...</p>
        </div>
      </div>
    }>
      <main className="flex flex-col items-center min-h-screen bg-background text-foreground font-sans">
        <div className="w-full"> 
          {isDesktop ? (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 xl:gap-8">
                {/* === Left Column === */}
                {/* === Left Column: Changed to grid layout === */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeUp">
                  {/* Hero Headlines: This is not a card, might need specific placement if grid is used for all items */}
                  {/* For now, let it be a grid item spanning full width on md if needed, or adjust its container separately */}
                  <div className="md:col-span-2">
                    {/* Original Hero Headlines Div (text-center lg:text-left) */}
                    <div className="relative text-center lg:text-left">
                      <div className="flex items-center align-left gap-3">
                        <div className="relative">
                          <div className="text-center">
                            <h1 className="font-orbitron text-4xl sm:text-5xl lg:text-6xl font-bold text-primary">
                              Banking AI Agents
                            </h1>
                            <h2 className="font-orbitron text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground">
                              Rewarding Humans
                            </h2>
                          </div>
                        </div>
                      </div>
                      <p className="mt-3 text-muted-foreground max-w-xl mx-auto lg:mx-0 font-sans">
                        Welcome to DEFAI Rewards. Check eligibility, activate your account, complete actions to earn {AIR.LABEL}, and climb the leaderboard!
                      </p>
                    </div>
                  </div>
                  
                  {/* Action Buttons Row: Spans full width */}
                  <div className="md:col-span-2">
                    <DashboardActionRow 
                      isRewardsActive={isRewardsActive}
                      currentTotalAirdropForSharing={currentTotalAirdropForSharing}
                      onShareToX={handleShareToX}
                      onLogSocialAction={logSocialAction}
                    />
                  </div>

                  {/* Airdrop Snapshot Horizontal: Spans full width on md, or takes one column if others are present */}
                  {/* This component is wide by nature. Let it span full for now. */}
                  {airdropSnapshotProps && (
                    <div className="md:col-span-2">
                      <AirdropSnapshotHorizontal {...airdropSnapshotProps} />
                    </div>
                  )}
                   {(authStatus !== "authenticated" || !wallet.connected || !isRewardsActive || hasSufficientDefai === false) && (
                    // This message card can take one column or span full if it's the only thing in a row
                    <div className="p-6 bg-card/80 backdrop-blur-md shadow-lg rounded-xl border border-border/50 text-center md:col-span-2">
                      <h3 className="text-xl font-semibold mb-2">Activate Your Account</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Connect your X account and wallet, and ensure you hold enough DEFAI to see your full airdrop snapshot and earn {AIR.LABEL}.
                      </p>
                    </div>
                  )}

                  {/* Milestones Card - this will now be a grid item */}
                  {showPointsSection && userData && (
                    <DashboardCard title={`Key Milestones & Achievements`} className="bg-card/80 backdrop-blur-md md:col-span-2">
                      <MilestoneTimeline milestones={sampleMilestonesData} />
                    </DashboardCard>
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
                    <DashboardCard title="Referral Link" className="bg-card/80 backdrop-blur-md">
                      {userData.activeReferralBoosts && userData.activeReferralBoosts.length > 0 && (
                          <span className="absolute top-3 right-3 px-2 py-0.5 text-xs font-bold text-black bg-yellow-400 rounded-full animate-pulse shadow-sm">
                            BOOST ACTIVE!
                          </span>
                        )}
                      <div className="flex items-center bg-muted/50 p-1.5 rounded-md border border-input mt-1">
                        <input type="text" readOnly value={`https://squad.defairewards.net/?ref=${userData.referralCode}`} aria-label="Your referral link" className="text-foreground text-xs break-all bg-transparent outline-none flex-grow p-1" />
                        {canShare ? (
                          <button 
                            onClick={handleShare}
                            className="ml-2 py-1 px-2 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                            aria-label="Share your referral link"
                          >
                            Share
                          </button>
                        ) : (
                          <button 
                            onClick={handleCopy}
                            className="ml-2 py-1 px-2 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                            aria-label="Copy your referral link to clipboard"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                    </DashboardCard>
                  )}

                  {isRewardsActive && !mySquadData && pendingInvites.length > 0 && (
                    <DashboardCard title="Squad Invitations" className="bg-card/80 backdrop-blur-md">
                      {isFetchingInvites && <p className="text-sm text-muted-foreground p-4 text-center">Loading invites...</p>}
                      {!isFetchingInvites && pendingInvites.length === 0 && <p className="text-sm text-muted-foreground p-4 text-center">No pending invitations.</p>}
                      {pendingInvites.length > 0 && (
                          <ul className="space-y-3 max-h-[300px] overflow-y-auto p-1">
                          {pendingInvites.map(invite => (
                              <SquadInvitationCard 
                                  key={invite.invitationId} 
                                  invite={invite} 
                                  onAction={handleInviteAction} 
                                  isProcessing={isProcessingInvite === invite.invitationId}
                              />
                          ))}
                          </ul>
                      )}
                    </DashboardCard>
                  )}
                </aside>
              </div>
            </div>
          ) : (
            // Mobile Layout (Existing Structure, but using AppHeader)
            <PullToRefreshDynamic onRefresh={handleRefresh} className="flex-grow w-full">
              {/* Added flex-grow and w-full to PullToRefresh for layout */}
              <div className="w-full max-w-3xl mx-auto px-4 pt-2 pb-20 flex flex-col items-center">
                {/* Added pb-20 to account for bottom tab bar space */}
                {/* Illustration and Headlines for Mobile (can be simpler or same as desktop) */}
                <div className="relative text-center mt-4 mb-6">
                  <div className="text-center mb-6 mt-4">
                    <h1 className="relative z-10 font-orbitron text-3xl sm:text-4xl font-bold text-primary">
                      Banking AI Agents
                    </h1>
                    <h2 className="relative z-10 font-orbitron text-3xl sm:text-4xl font-bold text-foreground">
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
                        className="w-full p-3 pl-4 pr-28 bg-card border border-input rounded-full focus:ring-1 focus:ring-primary text-sm text-foreground"
                        disabled={isCheckingAirdrop}
                      />
                      <button
                        onClick={handleInitialAirdropCheck} disabled={isCheckingAirdrop}
                        className="absolute right-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-1.5 px-4 rounded-full text-xs transition-all disabled:opacity-60"
                      >
                        {isCheckingAirdrop ? '...' : 'Check'}
                      </button>
                    </div>
                    {airdropCheckResultForTyped !== null && (
                      <div className="mt-4 p-3 bg-primary-subtle border border-primary-subtle-border rounded-lg text-center text-sm shadow-sm">
                        {typeof airdropCheckResultForTyped === 'number' ? (
                            airdropCheckResultForTyped > 0 ? (
                              <p>Eligible: <span className="font-bold text-positive">{formatPoints(airdropCheckResultForTyped)} {AIR.LABEL}</span>!</p>
                            ) : (
                              <p className="text-muted-foreground">Not on initial list. Earn {AIR.LABEL} for future rewards!</p>
                            )
                          ) : (
                            <p className="text-destructive">{airdropCheckResultForTyped}</p>
                          )
                        }
                      </div>
                    )}
                  </div>
                ) : null}
                
                {/* Existing Content Flow for Mobile when rewards active */}
                {showInsufficientBalanceMessage && (
                    <div className="w-full my-4 p-4 bg-primary-subtle border border-primary-subtle-border rounded-lg text-center shadow-sm">
                        <h3 className="text-base font-semibold text-primary-emphasis mb-2">Hold DeFAI Tokens</h3>
                        <p className="text-xs text-foreground mb-3">
                        To earn {AIR.LABEL}, hold {REQUIRED_DEFAI_AMOUNT} $DeFAI in wallet ({truncatedWalletAddress}). 
                        </p>
                        <Link href="https://dexscreener.com/solana/3jiwexdwzxjva2yd8aherfsrn7a97qbwmdz8i4q6mh7y" target="_blank" rel="noopener noreferrer" className="inline-block">
                            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground"><ChartIcon /> Buy DeFAI</Button>
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
                      <DashboardCard title="Your Referral Link" className="w-full text-center">
                        <div className="flex items-center bg-muted p-1.5 rounded border border-input mt-1">
                          <input type="text" readOnly value={`https://squad.defairewards.net/?ref=${userData.referralCode}`} aria-label="Your referral link" className="text-foreground text-xs break-all bg-transparent outline-none flex-grow p-0.5" />
                          {canShare ? (
                            <button 
                              onClick={handleShare}
                              className="ml-1.5 py-1 px-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                              aria-label="Share your referral link"
                            >
                              Share
                            </button>
                          ) : (
                            <button 
                              onClick={handleCopy}
                              className="ml-1.5 py-1 px-1.5 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                              aria-label="Copy your referral link to clipboard"
                            >
                              Copy
                            </button>
                          )}
                        </div>
                      </DashboardCard>
                    )}
                    <div className="w-full mt-3">
                      <DashboardCard title={`How to Earn More ${AIR.LABEL}`} className="w-full">
                         {/* If we want to keep the old detailed list, it could go here or be linked */}
                         {/* For now, the MilestoneTimeline has replaced the primary display in the desktop left column */}
                         <p className="text-sm text-muted-foreground p-3">Track your progress through key milestones above. Complete more actions to earn points and climb the leaderboard!</p>
                      </DashboardCard>
                    </div>
                  </div>
                )}
              </div>
            </PullToRefreshDynamic>
          )}
        </div>
        
        {/* Bottom branding - remains same */}
        <div className="fixed bottom-0 w-full flex justify-center p-2 z-20 pointer-events-none">
          <div className="bg-background text-positive rounded-lg px-3 py-1 text-xs font-medium shadow-lg pointer-events-auto">
            Built with ElizaOS
          </div>
        </div>

        {/* Welcome Modal - remains same */}
        <Dialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal}>
          <DialogContent className="sm:max-w-[525px] bg-card border-border shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold font-spacegrotesk text-center text-transparent bg-clip-text bg-gradient-to-r from-primary via-pink-500 to-orange-500 animate-pulse">
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
                className="w-full bg-gradient-to-r from-primary to-pink-500 hover:from-primary/90 hover:to-pink-500/90 text-primary-foreground font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all"
              >
                LFG!
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </ClientBoundary>
  );
}
