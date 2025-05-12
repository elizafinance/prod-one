"use client";

import { useState, useEffect, useCallback } from 'react';
import SiteLogo from "@/assets/logos/favicon.ico"; // Using favicon as the main small logo
import Illustration from "@/assets/images/tits.png"; // The illustration
import Link from 'next/link'; // Already imported, but confirming it's here
import { toast } from 'sonner'; // Import sonner toast
import { useWallet } from '@solana/wallet-adapter-react'; // Import useWallet
import dynamic from 'next/dynamic'; // Import dynamic
import { useSession, signIn, signOut } from "next-auth/react"; // NextAuth hooks

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
  { action: "Log in with X (First time)", points: 100, id: 'initial_connection' }, // Updated for X login
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

export default function HomePage() {
  const { data: session, status: authStatus } = useSession();
  const wallet = useWallet();

  // State for airdrop check (now independent of wallet connection initially)
  const [typedAddress, setTypedAddress] = useState('');
  const [airdropCheckResult, setAirdropCheckResult] = useState<string | number | null>(null);
  const [isCheckingAirdrop, setIsCheckingAirdrop] = useState(false);
  
  // State for rewards system (activated after X login AND wallet connection)
  const [isRewardsActive, setIsRewardsActive] = useState(false); // New state to control rewards UI visibility
  const [isActivatingRewards, setIsActivatingRewards] = useState(false);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [completedUserActions, setCompletedUserActions] = useState<string[]>([]);
  const [initialReferrer, setInitialReferrer] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) setInitialReferrer(refCode);
  }, []);

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
          referrerCodeFromQuery: initialReferrer 
        }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Rewards activated!");
        setUserPoints(data.points);
        setReferralCode(data.referralCode);
        setCompletedUserActions(data.completedActions || []);
        if (data.airdropAmount !== undefined) setAirdropCheckResult(data.airdropAmount);
        setIsRewardsActive(true);
        if (data.points > 0 || (data.points === 0 && data.message.includes("created"))) {
            toast.info(`Your current points: ${data.points?.toLocaleString() || 0}`);
        }
      } else {
        toast.error(data.error || "Failed to activate rewards.");
        setIsRewardsActive(false);
      }
    } catch (error) {
      toast.error("Error activating rewards.");
      setIsRewardsActive(false);
    }
    setIsActivatingRewards(false);
  }, [initialReferrer]);

  useEffect(() => {
    if (authStatus === "authenticated" && session?.user?.xId && wallet.connected && wallet.publicKey && !isRewardsActive && !isActivatingRewards) {
      const dbIdForApi = session.user.dbId === null ? undefined : session.user.dbId;
      activateRewardsAndFetchData(wallet.publicKey.toBase58(), session.user.xId, dbIdForApi);
    }
    if (authStatus === "authenticated" && !wallet.connected && isRewardsActive) {
      setIsRewardsActive(false);
      setUserPoints(null);
      setReferralCode(null);
      setCompletedUserActions([]);
    }
  }, [authStatus, session, wallet.connected, wallet.publicKey, isRewardsActive, isActivatingRewards, activateRewardsAndFetchData]);
  
  useEffect(() => {
    if (wallet.connected && wallet.publicKey && isRewardsActive && (userPoints !== null || referralCode !== null)) {
        const fetchCompleted = async () => {
            try {
                // Pass xUserId to completed-actions if available, for more precise lookup if needed by backend
                const apiUrl = `/api/users/completed-actions?address=${encodeURIComponent(wallet.publicKey!.toBase58())}` + (session?.user?.xId ? `&xUserId=${session.user.xId}` : '');
                const actionsResponse = await fetch(apiUrl);
                if (actionsResponse.ok) {
                    const actionsData = await actionsResponse.json();
                    setCompletedUserActions(actionsData.completedActions || []);
                } else {
                    console.error("Failed to fetch completed actions status:", await actionsResponse.text());
                }
            } catch (e) { console.error("Error fetching completed actions:", e); }
        };
        // Fetch completed actions only if the array is empty, or when userPoints/referralCode change (implying a state update)
        if(completedUserActions.length === 0 || (userPoints !== null && referralCode !== null)) fetchCompleted(); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.connected, wallet.publicKey, isRewardsActive, userPoints, referralCode, session?.user?.xId]);

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
    if (!wallet.connected || !wallet.publicKey) {
        toast.warning("Connect your wallet to earn points for this action.");
    }

    toast.info(`Attempting to log ${actionType.replace('_',' ')}...`);
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
        toast.success(data.message || `${actionType.replace('_',' ')} logged!`);
        if(data.newPointsTotal !== undefined) setUserPoints(data.newPointsTotal);
        if(wallet.publicKey && session.user.xId) {
            const apiUrl = `/api/users/completed-actions?address=${encodeURIComponent(wallet.publicKey.toBase58())}&xUserId=${session.user.xId}`;
            const actionsResponse = await fetch(apiUrl);
            if (actionsResponse.ok) {
                const actionsData = await actionsResponse.json();
                setCompletedUserActions(actionsData.completedActions || []);
            }
        }
      } else {
        toast.error(data.error || `Failed to log ${actionType.replace('_',' ')}.`);
      }
    } catch (error) {
      toast.error(`Error logging ${actionType.replace('_',' ')}.`);
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
    const siteBaseUrl = "https://claim.defairewards.net"; 
    const shareUrl = referralCode ? `${siteBaseUrl}/?ref=${referralCode}` : siteBaseUrl;
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

  if (authStatus === "loading") {
    return <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-white text-gray-900"><p className="font-orbitron text-xl">Loading Session...</p></main>;
  }

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-white text-gray-900 pt-8 sm:pt-12 font-sans">
      <div className="w-full max-w-4xl mx-auto flex justify-between items-center mb-8 px-2">
        <img 
          className="h-10 sm:h-12"
          src={SiteLogo.src} 
          alt="DeFAI Rewards Logo" 
        />
        {authStatus === "authenticated" && session?.user ? (
          <div className="flex items-center gap-3">
             {/* @ts-ignore */}
            <span className="text-sm text-gray-700">Hi, {session.user.name || session.user.xId}</span>
            <button 
              onClick={() => signOut()} 
              className="py-2 px-4 text-sm bg-red-500 hover:bg-red-600 text-white font-semibold rounded-full transition-colors"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button 
            onClick={() => signIn('twitter')} 
            className="py-2 px-5 bg-[#1DA1F2] hover:bg-[#0c85d0] text-white font-semibold rounded-full transition-colors flex items-center gap-2"
          >
            <XIcon /> Log in with X
          </button>
        )}
      </div>

      <h1 className="font-spacegrotesk text-4xl sm:text-5xl md:text-6xl font-bold text-black text-center">
        Banking AI Agents
      </h1>
      <h2 className="font-spacegrotesk text-4xl sm:text-5xl md:text-6xl font-bold text-black text-center mb-10">
        Rewarding Humans
      </h2>
      
      {/* Initial Airdrop Checker Section - Always visible if not X-authenticated or if X-auth but wallet not connected/rewards not active */}
      {authStatus !== "authenticated" || !isRewardsActive || !wallet.connected ? (
        <div className="w-full max-w-lg mb-8">
            <p className="text-center mb-4 text-black text-base sm:text-lg">
            Welcome to the DeFAIRewards $AIRdrop checker. First, check if an address is eligible for the airdrop. Sign in with X and connect your wallet to activate your defAIRewards account.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4">
                <input
                type="text"
                value={typedAddress}
                onChange={(e) => setTypedAddress(e.target.value)}
                placeholder="Enter any Solana address to check eligibility"
                className="flex-grow w-full sm:w-auto p-3 bg-white border border-gray-400 rounded-md focus:ring-2 focus:ring-[#2563EB] focus:border-[#2563EB] outline-none text-gray-900 placeholder-gray-500"
                disabled={isCheckingAirdrop || (authStatus === "authenticated" && isRewardsActive)}
                />
                <button
                onClick={handleInitialAirdropCheck}
                className="w-full sm:w-auto text-white font-semibold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 disabled:opacity-50 whitespace-nowrap"
                style={{ backgroundColor: '#2563EB' }} 
                disabled={isCheckingAirdrop || (authStatus === "authenticated" && isRewardsActive)}
                >
                {isCheckingAirdrop ? 'Checking...' : 'Check Eligibility'}
                </button>
            </div>
            {airdropCheckResult !== null && (
                <div className="mt-4 p-4 bg-gray-100 rounded-md text-center w-full">
                {typeof airdropCheckResult === 'number' ? (
                    <p className="text-lg text-gray-800">
                    This address qualifies for: <span className="font-bold text-xl text-green-600">{airdropCheckResult.toLocaleString()}</span> $AIR tokens.
                    </p>
                ) : (
                    <p className="text-lg text-red-600">{airdropCheckResult}</p>
                )}
                </div>
            )}
        </div>
      ) : null}

      {/* Prompt to Connect Wallet (If X logged in, airdrop checked, but wallet not connected) */}
      {authStatus === "authenticated" && !wallet.connected && (
        <div className="my-6 w-full max-w-md text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
          <p className="mb-3 text-lg text-purple-700 font-semibold">
            Connect Your Wallet to Activate Rewards!
          </p>
          <p className="mb-4 text-sm text-gray-700">
            You are logged in with X. Now connect your Solana wallet to activate your DeFAI Rewards account, see points, and get your referral link.
          </p>
          <WalletMultiButtonDynamic style={{ backgroundColor: '#2563EB' }} />
        </div>
      )}

      {/* Rewards Section - shows only if X is logged in AND wallet is connected AND rewards are activated */}
      {authStatus === "authenticated" && wallet.connected && isRewardsActive && (
        <div className="w-full max-w-lg mt-2 flex flex-col items-center">
           <p className="text-center text-sm text-gray-600 mb-1">Wallet: <span className="font-mono">{wallet.publicKey!.toBase58().substring(0,6)}...{wallet.publicKey!.toBase58().substring(wallet.publicKey!.toBase58().length - 4)}</span></p>
          {userPoints !== null && (
            <p className="mb-2 text-2xl font-bold font-spacegrotesk text-purple-600 text-center">DeFAI Points: {userPoints.toLocaleString()}</p>
          )}
          {typeof airdropCheckResult === 'number' && (
             <p className="text-center text-md text-gray-700 mb-4">
                Airdrop for this wallet: <span className="font-semibold text-green-600">{airdropCheckResult.toLocaleString()} $AIR</span>
             </p>
          )}
          
          {referralCode && (
            <div className="my-4 p-4 bg-gray-100 rounded-lg text-center w-full">
              <p className="text-md font-semibold text-gray-800 mb-2">Your Referral Link (Share & Earn!):</p>
              <div className="flex items-center justify-center bg-gray-200 p-2 rounded">
                <input type="text" readOnly value={`https://claim.defairewards.net/?ref=${referralCode}`} className="text-gray-700 text-sm break-all bg-transparent outline-none flex-grow p-1" />
                <button onClick={() => handleCopyToClipboard(`https://claim.defairewards.net/?ref=${referralCode}`)} className="ml-2 py-1 px-2 text-xs bg-[#2563EB] text-white rounded hover:bg-blue-700 transition-colors">
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-2 mb-4 flex flex-wrap justify-center gap-3 sm:gap-4 w-full">
            <Link href="https://defairewards.net" target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
              <button className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap" style={{ backgroundColor: '#2563EB' }}><HomeIcon /> Home</button>
            </Link>
            <Link href="https://dexscreener.com/solana/3jiwexdwzxjva2yd8aherfsrn7a97qbwmdz8i4q6mh7y" target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
              <button className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap" style={{ backgroundColor: '#2563EB' }}><ChartIcon /> Buy DeFAI</button>
            </Link>
            <Link href="/leaderboard" passHref className="flex-shrink-0">
              <button className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap" style={{ backgroundColor: '#2563EB' }}><LeaderboardIcon /> Leaderboard</button>
            </Link>
            {typeof airdropCheckResult === 'number' && airdropCheckResult > 0 && (
              <button onClick={handleShareToX} className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap" style={{ backgroundColor: '#2563EB' }} ><ShareIcon /> Flex my $AIR on X</button>
            )}
            <button onClick={() => { window.open("https://x.com/defairewards", "_blank"); logSocialAction('followed_on_x');}} className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap" style={{ backgroundColor: '#2563EB' }}><XIcon /> Follow on X</button>
            <button onClick={() => { window.open("https://t.me/defairewards", "_blank"); logSocialAction('joined_telegram');}} className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap" style={{ backgroundColor: '#2563EB' }}><TelegramIcon /> Join Telegram</button>
          </div>

          {/* Points Earning Table */}
          {userPoints !== null && (
            <div className="mt-2 mb-8 w-full">
              <h3 className="text-xl font-spacegrotesk font-semibold text-black mb-3 text-center">How to Earn More Points</h3>
              <div className="bg-gray-100 p-3 sm:p-4 rounded-lg shadow">
                <ul className="space-y-1.5">
                  {pointActivities.map((activity) => (
                    <li key={activity.id} className="flex justify-between items-center p-2 border-b border-gray-200 last:border-b-0">
                      <span className={`text-sm ${completedUserActions.includes(activity.id) ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                        {completedUserActions.includes(activity.id) ? '✅ ' : '✨ '}
                        {activity.action}
                      </span>
                      <span className={`font-semibold text-sm ${completedUserActions.includes(activity.id) ? 'text-gray-400 line-through' : 'text-purple-600'}`}>
                        {activity.points} pts
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="mt-auto w-full flex justify-center pt-8">
        <img 
            src={Illustration.src} 
            alt="Illustration" 
            className="w-[400px] h-auto"
        />
      </div>
    </main>
  );
}
