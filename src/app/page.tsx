"use client";

import { useEffect, useRef } from 'react';
import { useHomePageLogic } from '@/hooks/useHomePageLogic';
import { ArrowUpRight, ChevronDown, Clock, Wallet } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import Link from 'next/link';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import dynamic from 'next/dynamic';
import { useSession, signOut } from "next-auth/react";
import { ReferralBoost, SquadDocument, SquadInvitationDocument } from '@/lib/mongodb';
import UserAvatar from "@/components/UserAvatar";
import { PublicKey, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { useRouter, useSearchParams } from 'next/navigation';
import { useConnection } from '@solana/wallet-adapter-react';
import DeFAILogo from '@/components/DeFAILogo';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import AirdropInfoDisplay from "@/components/airdrop/AirdropInfoDisplay";
import { AIR } from '@/config/points.config';
import { formatPoints } from '@/lib/utils';
import AirdropSnapshotHorizontal from "@/components/dashboard/AirdropSnapshotHorizontal";
import DashboardActionRow from "@/components/layout/DashboardActionRow";
import MiniSquadCard from "@/components/dashboard/MiniSquadCard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import TopProposalCard from "@/components/dashboard/TopProposalCard";
import SquadGoalQuestCard from "@/components/dashboard/SquadGoalQuestCard";
import { useUserAirdrop, UserAirdropData as UserAirdropHookData } from '@/hooks/useUserAirdrop';
import ConnectXButton from '@/components/xauth/ConnectXButton';
import VerifyFollowButton from '@/components/xauth/VerifyFollowButton';

// Dynamically import WalletMultiButton
const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

// Define activities for the points table display
const pointActivities = [
  { action: `Log in with X (First time)`, points: AIR.INITIAL_LOGIN, id: 'initial_connection' },
  { action: `Connect Wallet (First time)`, points: AIR.WALLET_CONNECT_FIRST_TIME, id: 'wallet_connected_first_time' },
  { action: `Share Your Profile on X (Earns Referral Boost!)`, pointsString: "🚀 Boost", points: AIR.PROFILE_SHARE_ON_X, id: 'shared_milestone_profile_on_x' },
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
    update: updateSession,
  } = useHomePageLogic();

  const { update: nextAuthUpdateSession } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
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

    toast.info(`Attempting to log ${actionType.replace('_', ' ')}...`);
    try {
      const response = await fetch('/api/actions/log-social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          xUserId: session.user.xId,
          walletAddress: wallet.publicKey?.toBase58(),
          actionType
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || `${actionType.replace('_', ' ')} logged!`);
        // Note: userData will be refreshed automatically by useHomePageLogic
      } else {
        toast.error(data.error || `Failed to log ${actionType.replace('_', ' ')} action.`);
      }
    } catch (error) {
      toast.error(`Error logging ${actionType.replace('_', ' ')} action.`);
    }
  };

  const handleShareToX = () => {
    if (authStatus !== "authenticated" || !session?.user?.xId || !isRewardsActive) {
      toast.info("Log in with X and activate rewards to share.");
      return;
    }
    if (currentTotalAirdropForSharing <= 0) {
      toast.info("You need to have a calculated airdrop amount to share.");
      return;
    }
    const airdropAmountStr = currentTotalAirdropForSharing.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const siteBaseUrl = "https://squad.defairewards.net";
    const twitterHandle = "DeFAIRewards";
    const shareUrl = userData?.referralCode ? `${siteBaseUrl}/?ref=${userData.referralCode}` : `${siteBaseUrl}/?ref=d93263c7`;
    const text = `I'm getting ${airdropAmountStr} $DEFAI from @${twitterHandle} in the migration! 🚀 My referral link: ${shareUrl} \nGet ready for DEFAI SUMMER - buy $DeFAI now! #DeFAIRewards #TGE #AI #Solana`;
    const hashtags = "DeFAIRewards,TGE,AI,Solana";
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
        fetchPendingInvites();
        if (action === 'accept') {
          if (wallet.publicKey && session?.user?.xId && session?.user?.dbId) {
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

  // Process squad invite link for already-authenticated users
  useEffect(() => {
    if (
      authStatus === "authenticated" &&
      squadInviteIdFromUrl &&
      wallet.connected &&
      !isProcessingLinkInvite
    ) {
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
            fetchPendingInvites();
            setSquadInviteIdFromUrl(null);
          } else {
            console.warn("[HomePage] Process invite link error:", data.error || res.statusText);
          }
        } catch (err) {
          console.error("[HomePage] Failed to process squad invite link:", err);
        }
        setIsProcessingLinkInvite(false);
      };
      processInvite();
    }
  }, [authStatus, squadInviteIdFromUrl, wallet.connected, isProcessingLinkInvite, fetchPendingInvites, setIsProcessingLinkInvite, setSquadInviteIdFromUrl]);

  // Automatically prompt wallet connect modal right after X login
  useEffect(() => {
    if (
      authStatus === "authenticated" &&
      !wallet.connected &&
      !wallet.connecting &&
      !walletPromptedRef.current
    ) {
      walletPromptedRef.current = true;
      setTimeout(() => setWalletModalVisible(true), 100);
    }
    if (wallet.connected) {
      walletPromptedRef.current = false;
    }
  }, [authStatus, wallet.connected, wallet.connecting, setWalletModalVisible]);

  // Effect to handle X OAuth callback parameters
  useEffect(() => {
    const xConnectSuccess = searchParams.get('x_connect_success');
    const xConnectError = searchParams.get('x_connect_error');
    const currentPath = window.location.pathname;

    if (xConnectSuccess === 'true') {
      toast.success("X account linked successfully!");
      nextAuthUpdateSession();
      router.replace(currentPath, undefined);
    } else if (xConnectError) {
      let errorMessage = "Failed to link X account. Please try again.";
      if (xConnectError === 'config') {
        errorMessage = "X connection is not configured correctly on the server.";
      } else if (xConnectError === 'auth') {
        errorMessage = "Authentication failed. Please log in and try again.";
      } else if (xConnectError === 'missing_params') {
        errorMessage = "OAuth parameters missing. Please try again.";
      } else if (xConnectError === 'state_mismatch') {
        errorMessage = "Invalid request (state mismatch). Please try again.";
      } else if (xConnectError === 'no_code') {
        errorMessage = "Authorization code not received from X. Please try again.";
      } else if (xConnectError.length < 30) {
        errorMessage = `Error linking X: ${xConnectError.replace(/_/g, ' ')}.`;
      }
      toast.error(errorMessage);
      router.replace(currentPath, undefined);
    }
  }, [searchParams, nextAuthUpdateSession, router]);

  const airdropPoolSize = parseInt(process.env.NEXT_PUBLIC_AIRDROP_POINTS_POOL_SIZE || '1000000000', 10);
  const snapshotDateString = process.env.NEXT_PUBLIC_AIRDROP_SNAPSHOT_DATE_STRING || "May 20th";

  // Fetch totalCommunityPoints
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

  // Fetch defaiBalance
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
            setDefaiBalance(0);
          }
        }
      };
      fetchBalance();
    }
  }, [wallet.connected, wallet.publicKey, connection, setDefaiBalance]);

  if (authStatus === "loading") {
    return <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-foreground"><p className="font-orbitron text-xl">Loading Session...</p></main>;
  }

  if (authStatus !== "authenticated") {
    return (
      <SidebarInset>
        <main className="flex flex-col lg:flex-row min-h-screen w-full">
          <div className="flex flex-col justify-center items-center w-full bg-gradient-to-b from-background to-muted text-foreground px-8 py-12 space-y-8">
            <DeFAILogo className="h-16 w-16" />
            <h1 className="text-4xl md:text-5xl font-orbitron font-bold text-center">Welcome to DeFAI Rewards</h1>
            <p className="text-base md:text-lg text-center max-w-sm text-muted-foreground">Connect your wallet to start earning rewards.</p>
            <div className="flex flex-col gap-4 w-full max-w-xs items-center">
              <WalletMultiButtonDynamic />
            </div>
          </div>
        </main>
      </SidebarInset>
    );
  }

  if (!session?.user?.walletAddress) {
    return (
      <SidebarInset>
        <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-foreground text-center">
          <DeFAILogo className="h-20 w-20 mb-6" />
          <h1 className="text-3xl font-bold text-primary mb-4 font-orbitron">Almost There!</h1>
          <p className="text-lg mb-6 text-muted-foreground">Your X account is authenticated. Now, please connect your wallet to activate your DeFAI Rewards account.</p>
          <p className="text-sm text-muted-foreground">The Connect Wallet button is in the header.</p>
          {wallet.connecting && <p className="text-primary mt-4">Connecting to wallet...</p>}
        </main>
      </SidebarInset>
    );
  }

  const showPointsSection = authStatus === "authenticated" && wallet.connected && isRewardsActive && userData && hasSufficientDefai === true;
  const showInsufficientBalanceMessage = authStatus === "authenticated" && wallet.connected && isRewardsActive && userData && hasSufficientDefai === false;

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Dashboard</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto flex items-center gap-4 px-4">
          <Button variant="outline" className="hidden gap-2 md:flex">
            <Wallet className="h-4 w-4" />
            Connect Wallet
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Portfolio Overview */}
            {showPointsSection && userData && (
              <Card className="col-span-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Portfolio Overview</CardTitle>
                    <CardDescription>Your DeFAI rewards performance</CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-2">
                        Last 30 Days
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Last 7 Days</DropdownMenuItem>
                      <DropdownMenuItem>Last 30 Days</DropdownMenuItem>
                      <DropdownMenuItem>Last 90 Days</DropdownMenuItem>
                      <DropdownMenuItem>All Time</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-3">
                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-medium text-muted-foreground">Total Points</div>
                      <div className="text-3xl font-bold">{formatPoints(userData.points || 0)}</div>
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <ArrowUpRight className="h-4 w-4" />
                        <span>+5.2%</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-medium text-muted-foreground">Airdrop Allocation</div>
                      <div className="text-3xl font-bold">{formatPoints(userData.initialAirdropAmount || 0)}</div>
                      <div className="flex items-center gap-1 text-sm text-green-600">
                        <ArrowUpRight className="h-4 w-4" />
                        <span>Eligible</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="text-sm font-medium text-muted-foreground">Squad Rank</div>
                      <div className="text-3xl font-bold">{mySquadData ? '#' + (mySquadData.leaderboardRank || 'N/A') : 'No Squad'}</div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Updated 5m ago</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Activation Section */}
            {(authStatus === "authenticated" && wallet.connected && (!isRewardsActive || hasSufficientDefai === false)) && (
              <Card className="col-span-full">
                <CardHeader>
                  <CardTitle>Activate Your Rewards Account</CardTitle>
                  <CardDescription>Complete these steps to start earning rewards</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Step 1: Link X Account */}
                    <div className={`p-4 border rounded-lg ${session?.user?.linkedXUsername ? 'border-green-300 bg-green-50' : 'border-border bg-muted/50'}`}>
                      <div className="flex items-center justify-between">
                        <p className={`font-semibold ${session?.user?.linkedXUsername ? 'text-green-700' : 'text-foreground'}`}>
                          Step 1: Link X Account
                        </p>
                        {session?.user?.linkedXUsername && <span className="text-green-500 font-bold">✓</span>}
                      </div>
                      {!session?.user?.linkedXUsername && (
                        <p className="text-sm text-muted-foreground mt-1 mb-2">
                          Connect your X account to enable features and earn potential bonuses.
                        </p>
                      )}
                      <ConnectXButton />
                    </div>

                    {/* Step 2: Verify Follow Status */}
                    {session?.user?.linkedXUsername && (
                      <div className={`p-4 border rounded-lg ${session.user.followsDefAIRewards === true ? 'border-green-300 bg-green-50' : (session.user.followsDefAIRewards === false ? 'border-red-300 bg-red-50' : 'border-border bg-muted/50')}`}>
                        <div className="flex items-center justify-between">
                          <p className={`font-semibold ${session.user.followsDefAIRewards === true ? 'text-green-700' : (session.user.followsDefAIRewards === false ? 'text-red-700' : 'text-foreground')}`}>
                            Step 2: Verify Follow of @defAIRewards
                          </p>
                          {session.user.followsDefAIRewards === true && <span className="text-green-500 font-bold">✓</span>}
                          {session.user.followsDefAIRewards === false && <span className="text-red-500 font-bold">✗</span>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 mb-2">
                          Ensure you are following the <a href="https://x.com/defAIRewards" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">@defAIRewards</a> X account.
                        </p>
                        <VerifyFollowButton linkedXUsername={session.user.linkedXUsername} />
                      </div>
                    )}

                    {/* Step 3: Hold DEFAI */}
                    <div className={`p-4 border rounded-lg ${hasSufficientDefai === true ? 'border-green-300 bg-green-50' : 'border-border bg-muted/50'}`}>
                      <div className="flex items-center justify-between">
                        <p className={`font-semibold ${hasSufficientDefai === true ? 'text-green-700' : 'text-foreground'}`}>
                          Step 3: Hold Sufficient DEFAI
                        </p>
                        {hasSufficientDefai === true && <span className="text-green-500 font-bold">✓</span>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 mb-2">
                        Hold at least {REQUIRED_DEFAI_AMOUNT} $DEFAI in your wallet to activate all rewards.
                      </p>
                      {hasSufficientDefai !== true && (
                        <Link href="https://dexscreener.com/solana/3jiwexdwzxjva2yd8aherfsrn7a97qbwmdz8i4q6mh7y" target="_blank" rel="noopener noreferrer">
                          <Button size="sm" className="bg-[#3366FF] hover:bg-[#2952cc] text-white">
                            Buy DeFAI
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Airdrop Checker for non-authenticated */}
            {authStatus !== "authenticated" && (
              <Card className="col-span-full">
                <CardHeader>
                  <CardTitle>Check Airdrop Eligibility</CardTitle>
                  <CardDescription>Enter your Solana wallet address to check eligibility</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={typedAddress}
                      onChange={(e) => setTypedAddress(e.target.value)}
                      placeholder="Enter Solana address"
                      className="flex-1 p-3 border border-input rounded-md bg-background text-foreground"
                      disabled={isCheckingAirdrop}
                    />
                    <Button
                      onClick={handleInitialAirdropCheck}
                      disabled={isCheckingAirdrop}
                      className="bg-[#3366FF] hover:bg-[#2952cc]"
                    >
                      {isCheckingAirdrop ? '...' : 'Check'}
                    </Button>
                  </div>
                  {airdropCheckResultForTyped !== null && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center text-sm">
                      {typeof airdropCheckResultForTyped === 'number' ? (
                        airdropCheckResultForTyped > 0 ? (
                          <p>Eligible: <span className="font-bold text-green-600">{formatPoints(airdropCheckResultForTyped)} {AIR.LABEL}</span>!</p>
                        ) : (
                          <p className="text-muted-foreground">Not on initial list. Earn {AIR.LABEL} for future rewards!</p>
                        )
                      ) : (
                        <p className="text-red-600">{airdropCheckResultForTyped}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions and Progress Cards */}
            {showPointsSection && userData && (
              <>
                {/* Action Buttons Card */}
                <Card className="col-span-full lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Earn more points with these actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DashboardActionRow
                      isRewardsActive={isRewardsActive}
                      currentTotalAirdropForSharing={currentTotalAirdropForSharing}
                      onShareToX={handleShareToX}
                      onLogSocialAction={logSocialAction}
                      completedActions={userData?.completedActions || []}
                    />
                  </CardContent>
                </Card>

                {/* Squad Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>My Squad</CardTitle>
                    <CardDescription>Squad progress and details</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <MiniSquadCard
                      squadId={mySquadData?.squadId}
                      squadName={mySquadData?.name}
                      totalSquadPoints={mySquadData?.totalSquadPoints}
                      memberCount={mySquadData?.memberWalletAddresses.length}
                      maxMembers={mySquadData?.maxMembers}
                      isLeader={mySquadData?.leaderWalletAddress === wallet.publicKey?.toBase58()}
                      isLoading={isFetchingSquad}
                    />
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/squads">
                        View Squad Details
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>

                {/* Points Activities */}
                <Card className="col-span-full">
                  <CardHeader>
                    <CardTitle>How to Earn More {AIR.LABEL}</CardTitle>
                    <CardDescription>Complete these activities to earn points</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {pointActivities.map((activity) => {
                        const isCompleted = (userData.completedActions || []).includes(activity.id);
                        let isEffectivelyCompleted = isCompleted;
                        if (activity.id === 'shared_milestone_profile_on_x') {
                          const hasFrenzyBoost = userData.activeReferralBoosts?.some(b => b.description.includes('Referral Frenzy'));
                          isEffectivelyCompleted = isCompleted || !!hasFrenzyBoost;
                        }
                        return (
                          <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <span className={`text-sm ${isEffectivelyCompleted ? 'text-muted-foreground' : 'text-foreground'}`}>
                              {isEffectivelyCompleted ? '✅ ' : '✨ '}
                              {activity.action}
                            </span>
                            <Badge variant={isEffectivelyCompleted ? "secondary" : "default"}>
                              {activity.pointsString ? activity.pointsString : `${formatPoints(activity.points)} ${AIR.LABEL}`}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
      </div>

      {/* Welcome Modal */}
      <Dialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal}>
        <DialogContent className="sm:max-w-[525px] bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 border-purple-300 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold font-spacegrotesk text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 animate-pulse">
              Welcome to DeFAI Rewards!
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
                console.log("[WelcomeModal] Closed. Tutorial trigger point.");
              }}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all"
            >
              LFG!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarInset>
  );
}