"use client";

import { useState, useEffect, useCallback } from 'react';
import SiteLogo from "@/assets/logos/favicon.ico"; // Using favicon as the main small logo
import Illustration from "@/assets/images/tits.png"; // The illustration
import Link from 'next/link'; // Already imported, but confirming it's here
import { toast } from 'sonner'; // Import sonner toast
import { useWallet } from '@solana/wallet-adapter-react'; // Import useWallet
import dynamic from 'next/dynamic'; // Import dynamic
import { useSession, signIn, signOut } from "next-auth/react"; // NextAuth hooks
import { ReferralBoost, SquadDocument, SquadInvitationDocument } from '@/lib/mongodb'; // Import the ReferralBoost interface and SquadDocument
import { BellIcon } from '@heroicons/react/24/outline'; // Example icon, install @heroicons/react
import UserAvatar from "@/components/UserAvatar";
import { PublicKey, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { useRouter } from 'next/navigation';
import { useConnection } from '@solana/wallet-adapter-react';
import { checkRequiredEnvVars } from '@/utils/checkEnv';
import DeFAILogo from '@/components/DeFAILogo';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AirdropInfoDisplay from "@/components/airdrop/AirdropInfoDisplay";

// Dynamically import WalletMultiButton
const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

// Icons for buttons (simple text for now, can be replaced with actual icons)
const HomeIcon = () => <span>🏠</span>;
const ChartIcon = () => <span>📊</span>;
const LeaderboardIcon = () => <span>🏆</span>;
const XIcon = () => <span>✖️</span>; // Using a different X icon for clarity
const TelegramIcon = () => <span>✈️</span>;
const ShareIcon = () => <span>🔗</span>; // For Share on X specific button

// Define activities for the points table display
const pointActivities = [
  { action: "Log in with X (First time)", points: 100, id: 'initial_connection' },
  { action: "Connect Wallet (First time)", points: 100, id: 'wallet_connected_first_time' }, // Assuming you have this from previous step
  { action: "Share Your Profile on X (Earns Referral Boost!)", points: "🚀 Boost", id: 'shared_milestone_profile_on_x' },
  { action: "Share Airdrop Result on X", points: 50, id: 'shared_on_x' },
  { action: "Follow @DeFAIRewards on X", points: 30, id: 'followed_on_x' },
  { action: "Join DeFAIRewards Telegram", points: 25, id: 'joined_telegram' },
  { action: "Refer a Friend (they connect wallet after X login)", points: 20, id: 'referral_bonus' },
  { action: "Airdrop Tier: Bronze (>10k $AIR)", points: 50, id: 'airdrop_tier_bronze' },
  { action: "Airdrop Tier: Silver (>100k $AIR)", points: 150, id: 'airdrop_tier_silver' },
  { action: "Airdrop Tier: Gold (>1M $AIR)", points: 300, id: 'airdrop_tier_gold' },
  { action: "Airdrop Tier: Diamond (>10M $AIR)", points: 500, id: 'airdrop_tier_diamond' },
  { action: "Airdrop Tier: Master (>100M $AIR)", points: 1000, id: 'airdrop_tier_master' },
  { action: "Airdrop Tier: Grandmaster (>500M $AIR)", points: 5000, id: 'airdrop_tier_grandmaster' },
  { action: "Airdrop Tier: Legend (1B $AIR)", points: 10000, id: 'airdrop_tier_legend' },
  // Add more activities here as you define them
];

interface UserData {
  points: number;
  referralCode?: string;
  completedActions: string[];
  airdropAmount?: number;
  activeReferralBoosts?: ReferralBoost[];
  referralsMadeCount?: number;
  xUsername?: string;
  highestAirdropTierLabel?: string;
  squadId?: string;
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
  const { data: session, status: authStatus, update: updateSession } = useSession();
  const wallet = useWallet();
  const { connection } = useConnection(); // Correct usage
  const router = useRouter();

  // State for airdrop check (now independent of wallet connection initially)
  const [typedAddress, setTypedAddress] = useState('');
  const [airdropCheckResult, setAirdropCheckResult] = useState<string | number | null>(null);
  const [isCheckingAirdrop, setIsCheckingAirdrop] = useState(false);
  
  // State for rewards system (activated after X login AND wallet connection)
  const [isRewardsActive, setIsRewardsActive] = useState(false);
  const [isActivatingRewards, setIsActivatingRewards] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [mySquadData, setMySquadData] = useState<MySquadData | null>(null);
  const [isFetchingSquad, setIsFetchingSquad] = useState(false);
  const [userCheckedNoSquad, setUserCheckedNoSquad] = useState(false);
  const [initialReferrer, setInitialReferrer] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<EnrichedSquadInvitation[]>([]);
  const [isFetchingInvites, setIsFetchingInvites] = useState(false);
  const [isProcessingInvite, setIsProcessingInvite] = useState<string | null>(null); // invitationId being processed

  // ---> Add state for squad invite ID from URL
  const [squadInviteIdFromUrl, setSquadInviteIdFromUrl] = useState<string | null>(null);

  // State for DeFAI balance check
  const [isCheckingDefaiBalance, setIsCheckingDefaiBalance] = useState(false);
  const [hasSufficientDefai, setHasSufficientDefai] = useState<boolean | null>(null); // null = not checked, false = insufficient, true = sufficient

  // State for Welcome Modal
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Check required environment variables on component mount
  useEffect(() => {
    checkRequiredEnvVars();
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
       localStorage.setItem('referralCode', refCode); // Persist ref code
       setInitialReferrer(refCode);
    } else {
       const savedRefCode = localStorage.getItem('referralCode');
       if (savedRefCode) setInitialReferrer(savedRefCode);
    }

    // ---> Read squadInvite parameter
    const squadInviteParam = urlParams.get('squadInvite');
    if (squadInviteParam) {
      // Optionally persist this too, or just keep in state
      setSquadInviteIdFromUrl(squadInviteParam);
      console.log("[HomePage] Squad Invite ID from URL:", squadInviteParam);
    }

  }, []);

  const fetchMySquadData = useCallback(async (userWalletAddress: string) => {
    if (!userWalletAddress || isFetchingSquad || userCheckedNoSquad) return;
    console.log("[HomePage] Fetching squad data for:", userWalletAddress);
    setIsFetchingSquad(true);
    try {
      const response = await fetch(`/api/squads/my-squad?userWalletAddress=${encodeURIComponent(userWalletAddress)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.squad) {
          console.log("[HomePage] Squad data received:", data.squad);
          setMySquadData(data.squad as MySquadData);
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
    if (!wallet.connected || !session) return; // Need session for authenticated API call
    setIsFetchingInvites(true);
    try {
      const response = await fetch('/api/squads/invitations/my-pending');
      if (response.ok) {
        const data = await response.json();
        setPendingInvites(data.invitations || []);
      } else {
        console.error("Failed to fetch pending invites:", await response.text());
        setPendingInvites([]);
      }
    } catch (error) {
      console.error("Error fetching pending invites:", error);
      setPendingInvites([]);
    }
    setIsFetchingInvites(false);
  }, [wallet.connected, session]);

  const checkDefaiBalance = useCallback(async (userPublicKey: PublicKey, solanaConnection: Connection | undefined | null) => {
    if (!userPublicKey) {
      console.error("checkDefaiBalance called with invalid public key.");
      toast.error("Wallet error: Cannot verify DeFAI balance.");
      setHasSufficientDefai(null);
      return;
    }

    if (!solanaConnection) {
      console.error("checkDefaiBalance called with invalid connection object.");
      console.log("Wallet connection state:", wallet.connected ? "Connected" : "Disconnected");
      console.log("Connection object type:", solanaConnection === undefined ? "undefined" : solanaConnection === null ? "null" : typeof solanaConnection);
      toast.error("Connection error: Cannot verify DeFAI balance.");
      setHasSufficientDefai(null); // Indicate check couldn't run
      return;
    }

    const defaiMintAddress = process.env.NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS;
    if (!defaiMintAddress) {
      console.error("DeFAI mint address environment variable not set.");
      toast.error("Configuration error: Cannot verify DeFAI balance.");
      setHasSufficientDefai(false);
      return;
    }

    setIsCheckingDefaiBalance(true);
    try {
      const mintPublicKey = new PublicKey(defaiMintAddress);
      const associatedTokenAccount = await getAssociatedTokenAddress(mintPublicKey, userPublicKey);
      console.log(`Checking DeFAI balance for ATA: ${associatedTokenAccount.toBase58()}`);
      console.log(`Using Solana RPC endpoint: ${solanaConnection.rpcEndpoint}`);
      
      const balanceResponse = await solanaConnection.getTokenAccountBalance(associatedTokenAccount, 'confirmed');
      
      if (balanceResponse.value.uiAmount === null) {
         console.log('Token account not found or has null balance.');
         setHasSufficientDefai(false);
      } else {
         const balance = balanceResponse.value.uiAmount;
         console.log(`DeFAI balance: ${balance}`);
         setHasSufficientDefai(balance >= REQUIRED_DEFAI_AMOUNT);
      }

    } catch (error: any) {
      if (error.message?.includes('Account does not exist') || error.message?.includes('could not find account')) {
         console.log('DeFAI token account not found for user, balance is 0.');
         setHasSufficientDefai(false);
      } else {
         console.error("Error checking DeFAI balance:", error);
         toast.error("Could not verify DeFAI balance. Please try again later.");
         setHasSufficientDefai(null);
      }
    } finally {
      setIsCheckingDefaiBalance(false);
    }
  }, [wallet.connected]);

  const activateRewardsAndFetchData = useCallback(async (connectedWalletAddress: string, xUserId: string, userDbId: string | undefined) => {
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
      const data: UserData & { message?: string, error?: string, isNewUser?: boolean } = await response.json();
      if (response.ok) {
        toast.success(data.message || "Rewards activated!");
        setUserData(data);
        if (data.airdropAmount !== undefined) setAirdropCheckResult(data.airdropAmount);
        setIsRewardsActive(true);

        // ---> Force session update to reflect new walletAddress if linked
        console.log("[HomePage] Activation successful, attempting to update session.");
        await updateSession(); 
        console.log("[HomePage] Session update attempted.");

        if (data.points > 0 || (data.points === 0 && data.message && data.message.includes("created"))) {
            toast.info(`Your current points: ${data.points?.toLocaleString() || 0}`);
        }

        // ---> Check if it's a first-time activation
        const isFirstTimeActivation = data.isNewUser || (data.message && data.message.toLowerCase().includes("created"));
        if (isFirstTimeActivation) {
          console.log("[HomePage] First time activation detected, showing welcome modal.");
          setShowWelcomeModal(true);
        }

        // After successfully activating rewards, fetch squad data AND pending invites
        if (connectedWalletAddress) {
          fetchMySquadData(connectedWalletAddress);
          fetchPendingInvites(); // Fetch invites AFTER activation, which should now include the auto-generated one
        }
        // ON SUCCESSFUL ACTIVATION/FETCH: Trigger balance check
        if (wallet.publicKey) { // Ensure wallet.publicKey is available
          checkDefaiBalance(wallet.publicKey, connection);
        }
      } else {
        // Handle specific error cases to provide better user experience
        if (response.status === 409) {
          // This is a wallet conflict - show a modal or prominent message instead of a toast that disappears
          const errorMessage = data.error || "This wallet is already linked to another X account.";
          toast.error(errorMessage, {
            duration: 10000, // Longer duration
            id: "wallet-conflict-error" // Using an ID prevents duplicate toasts
          });
          
          // Set some state to show the user can't use this wallet and should disconnect
          setIsRewardsActive(false);
          setUserData(null);
          setMySquadData(null);
          setPendingInvites([]);
          
          // Suggest disconnecting the wallet
          toast.info("Please disconnect this wallet and try with a different one, or use the X account linked to this wallet.", {
            duration: 10000,
            id: "wallet-conflict-suggestion"
          });
        } else {
          // Handle other errors normally
          toast.error(data.error || "Failed to activate rewards.");
          setIsRewardsActive(false);
          setUserData(null);
          setMySquadData(null);
          setPendingInvites([]);
        }
      }
    } catch (error) {
      toast.error("Error activating rewards.");
      setIsRewardsActive(false);
      setUserData(null);
      setMySquadData(null);
      setPendingInvites([]);
    }
    setIsActivatingRewards(false);
  }, [initialReferrer, squadInviteIdFromUrl, fetchMySquadData, fetchPendingInvites, connection, wallet.publicKey, checkDefaiBalance, updateSession]);

  useEffect(() => {
    if (authStatus === "authenticated" && session?.user?.xId && session?.user?.dbId && wallet.connected && wallet.publicKey && !isRewardsActive && !isActivatingRewards) {
      // Ensure dbId is also present, indicating our signIn callback likely completed its DB ops for this user
      const dbIdForApi = session.user.dbId; // No need to check for null if it's in the condition
      activateRewardsAndFetchData(wallet.publicKey.toBase58(), session.user.xId, dbIdForApi);
    } else if (authStatus === "authenticated" && wallet.connected && wallet.publicKey && isRewardsActive && hasSufficientDefai === null && !isCheckingDefaiBalance) {
      // New logic: If already authenticated/connected/rewards active, check balance if not already done/checked
      console.log("Rewards active, checking DeFAI balance...");
      
      // Small delay to ensure connection is fully established
      setTimeout(() => {
        if (connection && wallet.publicKey) {
          checkDefaiBalance(wallet.publicKey, connection);
        } else {
          console.error("Connection or wallet public key not available after delay");
          toast.error("Connection error: Please try refreshing the page");
        }
      }, 1000);
    } else if (authStatus === "authenticated" && wallet.connected && isRewardsActive && !isFetchingInvites) {
        // Fetch invites if rewards are active and not already fetching them (e.g., on page load/refresh if already activated)
        fetchPendingInvites();
    }
    if (authStatus === "authenticated" && !wallet.connected && isRewardsActive) {
      setIsRewardsActive(false);
      setUserData(null);
      setMySquadData(null);
      setUserCheckedNoSquad(false);
    }
  }, [
      authStatus, session, wallet.connected, wallet.publicKey, isRewardsActive, 
      isActivatingRewards, activateRewardsAndFetchData, userData, mySquadData, 
      fetchMySquadData, isFetchingSquad, pendingInvites, fetchPendingInvites, 
      userCheckedNoSquad, 
      hasSufficientDefai, // Added balance state
      isCheckingDefaiBalance, // Added balance check state
      connection, // Added connection
      checkDefaiBalance, // Added check function
      updateSession // Added updateSession
    ]);
  
  // Reset the userCheckedNoSquad flag when wallet changes
  useEffect(() => {
    if (wallet.publicKey) {
      setUserCheckedNoSquad(false);
    }
  }, [wallet.publicKey]);

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
      const data = await response.json();
      if (response.ok) {
        setAirdropCheckResult(data.AIRDROP);
        if (typeof data.AIRDROP === 'number') {
            toast.success(`This address qualifies for ${data.AIRDROP.toLocaleString()} $AIR.`);
        } else {
            toast.info(data.error || "This address does not qualify for the airdrop.");
        }
      } else {
        setAirdropCheckResult(data.error || "Airdrop status unknown.");
        toast.error(data.error || "Could not check airdrop status.");
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
          setUserData(prev => prev ? {...prev, points: data.newPointsTotal, completedActions: [...(prev.completedActions || []), actionType] } : null);
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
    if (typeof airdropCheckResult !== 'number' || airdropCheckResult <= 0) {
        toast.info("You need to qualify for the airdrop to use this share feature.");
        return;
    }
    const airdropAmountStr = airdropCheckResult.toLocaleString();
    const siteBaseUrl = "https://squad.defairewards.net";
    const shareUrl = userData?.referralCode ? `${siteBaseUrl}/?ref=${userData.referralCode}` : siteBaseUrl;
    const twitterHandle = "DeFAIRewards";
    const tokenToBuy = "$DeFAI"; 
    const snapshotDate = "May 20, 2025";
    const text = `I'm getting ${airdropAmountStr} $AIR from @${twitterHandle}! 🚀 My referral link: ${shareUrl} \nGet ready for the ${snapshotDate} snapshot - buy ${tokenToBuy} now!`;
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

  if (authStatus === "loading") {
    return <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-white text-gray-900"><p className="font-orbitron text-xl">Loading Session...</p></main>;
  }

  // Determine if points/actions section should be shown
  const showPointsSection = authStatus === "authenticated" && wallet.connected && isRewardsActive && userData && hasSufficientDefai === true;
  // Determine if the "Insufficient Balance" message should be shown
  const showInsufficientBalanceMessage = authStatus === "authenticated" && wallet.connected && isRewardsActive && userData && hasSufficientDefai === false;

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-white text-gray-900 font-sans relative">
      {/* Main content moved up significantly */}
      <div className="w-full max-w-3xl mx-auto pt-8 flex flex-col items-center relative">
        {/* Illustration - moved here, positioned behind text */}
        <div className="absolute top-[-40px] left-1/2 transform -translate-x-1/2 z-0 opacity-50 pointer-events-none">
          <img 
            src={Illustration.src} 
            alt="Illustration" 
            className="w-[400px] sm:w-[500px] h-auto"
          />
        </div>

        {/* Heading with blue and black text - ensure they are above illustration */}
        <h1 className="relative z-10 font-spacegrotesk text-5xl sm:text-6xl md:text-7xl font-bold text-center mb-2 mt-40"> {/* Added margin top */} 
          <span className="text-[#2B96F1]">Banking AI Agents</span>
        </h1>
        <h2 className="relative z-10 font-spacegrotesk text-5xl sm:text-6xl md:text-7xl font-bold text-black text-center mb-6">
          Rewarding Humans
        </h2>
        
        {/* Welcome text - moved up - ensure above illustration */}
        <p className="relative z-10 text-center text-gray-600 max-w-xl mx-auto mb-6">
          Welcome to the DeFAIRewards $AIRdrop checker. First, check if an address is eligible for the airdrop. Sign in with X and connect your wallet to activate your defAIRewards account.
        </p>
        
        {/* Airdrop checker input - moved up further */}
        {authStatus !== "authenticated" || !isRewardsActive || !wallet.connected ? (
          <div className="w-full mb-8">
            <div className="relative flex items-center mt-2 mb-6">
              <input
                type="text"
                value={typedAddress}
                onChange={(e) => setTypedAddress(e.target.value)}
                placeholder="Enter any Solana address to check eligibility"
                className="w-full p-4 pl-5 pr-32 bg-gray-50 border border-gray-200 rounded-full focus:ring-2 focus:ring-[#2B96F1] focus:border-[#2B96F1] outline-none text-gray-800"
                disabled={isCheckingAirdrop || (authStatus === "authenticated" && isRewardsActive)}
              />
              <button
                onClick={handleInitialAirdropCheck}
                className="absolute right-2 bg-[#2B96F1] hover:bg-blue-500 text-white font-medium py-2 px-6 rounded-full transition-all disabled:opacity-50"
                disabled={isCheckingAirdrop || (authStatus === "authenticated" && isRewardsActive)}
              >
                {isCheckingAirdrop ? 'Checking...' : 'Check Eligibility'}
              </button>
            </div>
            {airdropCheckResult !== null && (
                <div className="mt-6 p-5 bg-blue-50 border border-blue-200 rounded-lg text-center shadow-sm">
                  {typeof airdropCheckResult === 'number' ? (
                      airdropCheckResult > 0 ? (
                        <p className="text-center text-3xl font-bold mb-4 animate-pulse">
                          Eligible for: <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500">{airdropCheckResult.toLocaleString()}</span> $AIR!
                        </p>
                      ) : (
                        <div>
                          <p className="text-center text-lg text-gray-600 mb-4">
                            You dont qualify because your $DEFAI balance is zero.
                          </p>
                          <Link href="https://dexscreener.com/solana/3jiwexdwzxjva2yd8aherfsrn7a97qbwmdz8i4q6mh7y" target="_blank" rel="noopener noreferrer">
                            <button className="text-white font-semibold py-2 px-4 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap" style={{ backgroundColor: '#2563EB' }}>
                              <ChartIcon /> Buy $Defai
                            </button>
                          </Link>
                        </div>
                      )
                    ) : (
                        <p className="text-center text-lg text-red-600 mb-4">
                            Airdrop Status: {airdropCheckResult}
                        </p>
                    )
                  }
                </div>
            )}
          </div>
        ) : null}
        
        {/* Content wrapper - Remove overflow-y-auto and hide-scrollbar */}
        <div className="w-full max-w-xl mb-32"> 
          
          {/* Other sections without duplicating login buttons */}
          {authStatus === "authenticated" && !wallet.connected && (
            <div className="my-6 w-full text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-600 mb-3">
                You are logged in with X. Connect your wallet using the button in the header to activate your DeFAI Rewards account.
              </p>
            </div>
          )}
          
          {/* Other sections */}
          {showInsufficientBalanceMessage && (
            <div className="w-full my-6 p-5 bg-blue-50 border border-blue-200 rounded-lg text-center shadow-md">
              <h3 className="text-xl font-semibold text-blue-700 mb-3">Action Required: Hold DeFAI Tokens</h3>
              <p className="text-gray-700 mb-4">
                To participate in the DeFAI Rewards points system and access all features, you need to hold at least {REQUIRED_DEFAI_AMOUNT} $DeFAI tokens in your connected wallet ({wallet.publicKey?.toBase58().substring(0,6)}...).
              </p>
              <Link href="https://dexscreener.com/solana/3jiwexdwzxjva2yd8aherfsrn7a97qbwmdz8i4q6mh7y" target="_blank" rel="noopener noreferrer" className="inline-block">
                <button className="text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap bg-[#2B96F1]">
                  <ChartIcon /> Buy DeFAI on DexScreener
                </button>
              </Link>
            </div>
          )}

          {/* Rewards Section - Renders ONLY if balance check passes */}
          {showPointsSection && userData && (
            <div className="w-full max-w-lg mt-2 flex flex-col items-center">
              <AirdropInfoDisplay />

              <p className="text-center text-sm text-gray-600 mb-1">Wallet: <span className="font-mono">{wallet.publicKey!.toBase58().substring(0,6)}...{wallet.publicKey!.toBase58().substring(wallet.publicKey!.toBase58().length - 4)}</span></p>
              {userData.referralCode && (
                <div className="my-4 p-4 bg-gray-100 rounded-lg text-center w-full">
                  <div className="flex justify-center items-center mb-2">
                    <p className="text-md font-semibold text-gray-800">Your Referral Link (Share & Earn!):</p>
                    {userData.activeReferralBoosts && userData.activeReferralBoosts.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-bold text-black bg-yellow-400 rounded-full animate-pulse">
                        BOOST ACTIVE!
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center bg-gray-200 p-2 rounded">
                    <input type="text" readOnly value={`https://squad.defairewards.net/?ref=${userData.referralCode}`} className="text-gray-700 text-sm break-all bg-transparent outline-none flex-grow p-1" />
                    <button onClick={() => handleCopyToClipboard(`https://squad.defairewards.net/?ref=${userData.referralCode}`)} className="ml-2 py-1 px-2 text-xs bg-[#2563EB] text-white rounded hover:bg-blue-700 transition-colors">
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {/* Display Active Referral Boosts */}
              {userData.activeReferralBoosts && userData.activeReferralBoosts.length > 0 && (
                <div className="w-full max-w-md p-5 bg-gradient-to-br from-indigo-50 to-purple-50 border border-purple-200 rounded-xl shadow-lg mt-6 mb-4">
                  <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-3 text-center">
                    🚀 Active Referral Boosts!
                  </h3>
                  <ul className="space-y-3">
                    {userData.activeReferralBoosts.map(boost => (
                      <li key={boost.boostId} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <p className="font-semibold text-indigo-700">{boost.description}</p>
                        <p className="text-sm text-gray-600 mt-1">Remaining Uses: <span className="font-medium text-purple-700">{boost.remainingUses}</span></p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Display Referrals Made Count */}
              {typeof userData.referralsMadeCount === 'number' && userData.referralsMadeCount > 0 && (
                <div className="my-3 text-center">
                  <p className="text-md text-gray-700">You have successfully referred <span className="font-bold text-green-500">{userData.referralsMadeCount}</span> user(s)! Keep it up!</p>
                </div>
              )}

              {/* My Squad Section - replaced with navigation button */}
              <div className="w-full max-w-md p-5 bg-indigo-50 border border-indigo-200 rounded-xl shadow-md mt-8 mb-4">
                <h3 className="text-xl font-bold text-indigo-700 mb-3 text-center">🛡️ My Squad</h3>
                <Link href="/squads/my" passHref>
                  <button className="mt-3 py-2 px-4 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors w-full shadow hover:shadow-md">
                    Go to My Squad Page
                  </button>
                </Link>
              </div>

              {/* Link to Public Profile */}
              {userData.walletAddress && (
                <div className="w-full max-w-md mt-6 mb-4 text-center">
                  <Link href={`/profile/${userData.walletAddress}`} passHref>
                    <button 
                      className="py-2.5 px-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out"
                    >
                      View My Public Showcase
                    </button>
                  </Link>
                </div>
              )}

              {/* Pending Squad Invitations Section */}
              {!mySquadData && pendingInvites.length > 0 && (
                <div className="w-full max-w-md p-5 bg-teal-50 border border-teal-200 rounded-xl shadow-md mt-8 mb-4">
                  <h3 className="text-xl font-bold text-teal-700 mb-3 text-center">💌 Squad Invitations</h3>
                  {isFetchingInvites && <p className="text-center text-teal-600">Loading invitations...</p>}
                  <ul className="space-y-3">
                    {pendingInvites.map(invite => (
                      <li key={invite.invitationId} className="p-3 bg-white/80 rounded-lg shadow">
                        <div className="flex items-center gap-2 mb-2">
                          <UserAvatar 
                            profileImageUrl={invite.inviterInfo?.xProfileImageUrl} 
                            username={invite.inviterInfo?.xUsername}
                            size="sm"
                          />
                          <div>
                            <p className="text-sm text-gray-700">
                              You have been invited to join <strong className="text-teal-600">{invite.squadName}</strong>
                            </p>
                            <p className="text-xs text-gray-500">
                              Invited by: {invite.inviterInfo?.xUsername ? 
                                `@${invite.inviterInfo.xUsername}` : 
                                `${invite.invitedByUserWalletAddress.substring(0,6)}...`}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button 
                            onClick={() => handleInviteAction(invite.invitationId, 'accept')}
                            disabled={isProcessingInvite === invite.invitationId}
                            className="flex-1 py-1.5 px-3 text-sm bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md disabled:opacity-70"
                          >
                            {isProcessingInvite === invite.invitationId ? 'Processing...' : 'Accept'} 
                          </button>
                          <button 
                            onClick={() => handleInviteAction(invite.invitationId, 'decline')}
                            disabled={isProcessingInvite === invite.invitationId}
                            className="flex-1 py-1.5 px-3 text-sm bg-red-500 hover:bg-red-600 text-white font-semibold rounded-md disabled:opacity-70"
                          >
                            {isProcessingInvite === invite.invitationId ? 'Processing...' : 'Decline'}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-2 mb-4 flex flex-wrap justify-center gap-3 sm:gap-4 w-full">
                <Link href="https://defairewards.net" target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                  <button className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap" style={{ backgroundColor: '#2563EB' }}><HomeIcon /> Home</button>
                </Link>
                <Link href="/leaderboard" passHref className="flex-shrink-0">
                  <button className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap" style={{ backgroundColor: '#2563EB' }}><LeaderboardIcon /> Leaderboard</button>
                </Link>
                {typeof userData.airdropAmount === 'number' && userData.airdropAmount > 0 && (
                  <button onClick={handleShareToX} className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap" style={{ backgroundColor: '#2563EB' }} ><ShareIcon /> Flex my $AIR on X</button>
                )}
                <button onClick={() => { window.open("https://x.com/defairewards", "_blank"); logSocialAction('followed_on_x');}} className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap" style={{ backgroundColor: '#2563EB' }}><XIcon /> Follow on X</button>
                <button onClick={() => { window.open("https://t.me/defairewards", "_blank"); logSocialAction('joined_telegram');}} className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap" style={{ backgroundColor: '#2563EB' }}><TelegramIcon /> Join Telegram</button>
              </div>

              {/* Points Earning Table */}
              {userData.points !== null && (
                <div className="mt-2 mb-8 w-full">
                  <h3 className="text-xl font-spacegrotesk font-semibold text-black mb-3 text-center">How to Earn More Points</h3>
                  <div className="bg-gray-100 p-3 sm:p-4 rounded-lg shadow">
                    <ul className="space-y-1.5">
                      {pointActivities.map((activity) => {
                        const isCompleted = userData.completedActions.includes(activity.id);
                        // Special check for profile share boost: consider it "done" if they have an active frenzy boost,
                        // or if they've completed the 'shared_milestone_profile_on_x' action.
                        let isEffectivelyCompleted = isCompleted;
                        if (activity.id === 'shared_milestone_profile_on_x') {
                          const hasFrenzyBoost = userData.activeReferralBoosts?.some(b => b.description.includes('Referral Frenzy'));
                          isEffectivelyCompleted = isCompleted || !!hasFrenzyBoost;
                        }

                        return (
                          <li key={activity.id} className="flex justify-between items-center p-2 border-b border-gray-200 last:border-b-0">
                            <span className={`text-sm ${isEffectivelyCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                              {isEffectivelyCompleted ? '✅ ' : '✨ '}
                              {activity.action}
                            </span>
                            <span className={`font-semibold text-sm ${isEffectivelyCompleted ? 'text-gray-400 line-through' : (typeof activity.points === 'number' ? 'text-purple-600' : 'text-yellow-500')}`}>
                              {typeof activity.points === 'number' ? `${activity.points} pts` : activity.points}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Loading indicator for balance check */}
          {authStatus === "authenticated" && wallet.connected && isCheckingDefaiBalance && (
             <div className="my-4 text-center text-gray-600">
                <p>Verifying DeFAI token balance...</p>
             </div>
          )}
        </div>
      </div>
      
      {/* Bottom branding */}
      <div className="absolute bottom-0 w-full flex justify-center p-2 z-10">
        <div className="bg-black text-green-400 rounded-lg px-3 py-1 text-sm font-medium">
          Built with ElizaOS
        </div>
      </div>

      {/* Welcome Modal */}
      <Dialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal}>
        <DialogContent className="sm:max-w-[525px] bg-gradient-to-br from-purple-100 via-pink-100 to-orange-100 border-purple-300 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold font-spacegrotesk text-center text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 animate-pulse">
              Squad Goals! Welcome to defAIRewards!
            </DialogTitle>
            <DialogDescription className="text-center text-gray-700 pt-2">
              You have successfully activated your account. Here is how to get started:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3 text-sm text-gray-800">
            <p>✨ <span className="font-semibold">Earn Points:</span> Connect your wallet, follow us on X, join Telegram, and share your profile/airdrop results to earn DeFAI points.</p>
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
