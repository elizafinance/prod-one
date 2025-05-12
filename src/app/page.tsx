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

const REQUIRED_DEFAI_AMOUNT = 100; // Require 100 whole tokens

export default function HomePage() {
  const { data: session, status: authStatus } = useSession();
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

  // State for DeFAI balance check
  const [isCheckingDefaiBalance, setIsCheckingDefaiBalance] = useState(false);
  const [hasSufficientDefai, setHasSufficientDefai] = useState<boolean | null>(null); // null = not checked, false = insufficient, true = sufficient

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

    const defaiMintAddress = process.env.NEXT_PUBLIC_DEFAI_CONTRACT_ADDRESS;
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
          walletAddress: connectedWalletAddress, xUserId: xUserId, userDbId: userDbId, referrerCodeFromQuery: initialReferrer 
        }),
      });
      const data: UserData & { message?: string, error?: string } = await response.json();
      if (response.ok) {
        toast.success(data.message || "Rewards activated!");
        setUserData(data);
        if (data.airdropAmount !== undefined) setAirdropCheckResult(data.airdropAmount);
        setIsRewardsActive(true);
        if (data.points > 0 || (data.points === 0 && data.message && data.message.includes("created"))) {
            toast.info(`Your current points: ${data.points?.toLocaleString() || 0}`);
        }
        // After successfully activating rewards, fetch squad data AND pending invites
        if (connectedWalletAddress) {
          fetchMySquadData(connectedWalletAddress);
          fetchPendingInvites(); // Fetch invites after activating rewards
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
  }, [initialReferrer, fetchMySquadData, fetchPendingInvites, connection, wallet.publicKey, checkDefaiBalance]);

  useEffect(() => {
    if (authStatus === "authenticated" && session?.user?.xId && wallet.connected && wallet.publicKey && !isRewardsActive && !isActivatingRewards) {
      const dbIdForApi = session.user.dbId === null ? undefined : session.user.dbId;
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
      checkDefaiBalance // Added check function
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
    const siteBaseUrl = "https://kol-claim.defairewards.net";
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
    <main className="flex flex-col items-center h-screen overflow-hidden p-4 sm:p-8 bg-white text-gray-900 font-sans relative">
      {/* Main content moved up significantly */}
      <div className="w-full max-w-3xl mx-auto pt-8 flex flex-col items-center">
        {/* Heading with blue and black text */}
        <h1 className="font-spacegrotesk text-5xl sm:text-6xl md:text-7xl font-bold text-center mb-2">
          <span className="text-[#2B96F1]">Banking AI Agents</span>
        </h1>
        <h2 className="font-spacegrotesk text-5xl sm:text-6xl md:text-7xl font-bold text-black text-center mb-6">
          Rewarding Humans
        </h2>
        
        {/* Welcome text - moved up */}
        <p className="text-center text-gray-600 max-w-xl mx-auto mb-6">
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
              <div className="mt-6 p-5 bg-green-50 border border-green-200 rounded-lg text-center shadow-sm">
                {typeof airdropCheckResult === 'number' ? (
                  airdropCheckResult > 0 ? (
                    <p className="text-center text-3xl font-bold mb-4 animate-pulse">
                      Eligible for: <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500">{airdropCheckResult.toLocaleString()}</span> $AIR!
                    </p>
                  ) : (
                    <p className="text-center text-lg text-gray-600 mb-4">
                      This address does not qualify for the $AIR airdrop (amount: {airdropCheckResult}).
                    </p>
                  )
                ) : (
                  <p className="text-center text-lg text-red-600 mb-4">
                    Airdrop Status: {airdropCheckResult}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : null}
        
        {/* Content wrapper with scrollable content if needed */}
        <div className="w-full max-w-xl overflow-y-auto hide-scrollbar mb-32"> {/* Add bottom margin to avoid overlap */}
          
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
            <div className="w-full my-6 p-5 bg-orange-50 border border-orange-200 rounded-lg text-center shadow-md">
              <h3 className="text-xl font-semibold text-orange-700 mb-3">Action Required: Hold DeFAI Tokens</h3>
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
        </div>
      </div>
      
      {/* Bottom branding */}
      <div className="absolute bottom-0 w-full flex justify-center p-2 z-10">
        <div className="bg-black text-green-400 rounded-lg px-3 py-1 text-sm font-medium">
          Built with ElizaOS
        </div>
      </div>
      
      {/* Anime girl illustration - properly positioned at bottom */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center opacity-80 pointer-events-none">
        <img 
          src={Illustration.src} 
          alt="Illustration" 
          className="w-[400px] h-auto"
        />
      </div>
    </main>
  );
}
