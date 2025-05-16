/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { toast } from 'sonner';
import { SparklesIcon, CurrencyDollarIcon, GiftIcon, CalendarDaysIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useSession } from 'next-auth/react';
import { TOKEN_LABEL_AIR, TOKEN_LABEL_POINTS } from '@/lib/labels';

interface AirdropInfoDisplayProps {
  onNotConnected?: () => React.ReactNode;
  showTitle?: boolean;
  onTotalAirdropChange?: (totalAirdrop: number) => void;
}

const AirdropInfoDisplay: React.FC<AirdropInfoDisplayProps> = ({ onNotConnected, showTitle = true, onTotalAirdropChange }) => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { data: session, status: authStatus } = useSession();

  const [defaiBalance, setDefaiBalance] = useState<number | null>(null);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [totalCommunityPoints, setTotalCommunityPoints] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialAirdropAllocation, setInitialAirdropAllocation] = useState<number | null>(null);

  const tokenMintAddress = process.env.NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS;
  const tokenDecimals = parseInt(process.env.NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS || '9', 10);
  const snapshotDateString = process.env.NEXT_PUBLIC_AIRDROP_SNAPSHOT_DATE_STRING || "May 20th";
  const airdropPoolSize = parseInt(process.env.NEXT_PUBLIC_AIRDROP_POINTS_POOL_SIZE || '1000000000', 10);

  // useEffect for onTotalAirdropChange: Moved to top, depends on constituent states.
  useEffect(() => {
    if (onTotalAirdropChange) {
      const currentPointsShare = 
        userPoints !== null && userPoints > 0 && totalCommunityPoints !== null && totalCommunityPoints > 0 
        ? (userPoints / totalCommunityPoints) * airdropPoolSize 
        : 0;
      const currentTotalEstimatedAirdrop = 
        (initialAirdropAllocation || 0) + 
        (defaiBalance !== null ? defaiBalance : 0) + 
        currentPointsShare;
      onTotalAirdropChange(currentTotalEstimatedAirdrop);
    }
  }, [initialAirdropAllocation, defaiBalance, userPoints, totalCommunityPoints, airdropPoolSize, onTotalAirdropChange]);

  const fetchAirdropData = useCallback(async () => {
    if (!connected || !publicKey || !session?.user?.walletAddress) {
      setDefaiBalance(null);
      setUserPoints(null);
      return;
    }
    
    setIsLoading(true);
    setError(null);

    let fetchedBalance: number | null = null;
    let fetchedUserPoints: number | null = null;
    let fetchedTotalCommunityPoints: number | null = null;
    let fetchError: string | null = null;

    try {
      const [balanceResult, pointsResult, totalPointsResult, initialAirdropResult] = await Promise.allSettled([
        (async () => {
          if (tokenMintAddress) {
            const mint = new PublicKey(tokenMintAddress);
            const ata = await getAssociatedTokenAddress(mint, publicKey);
            const accountInfo = await getAccount(connection, ata, 'confirmed');
            return Number(accountInfo.amount) / (10 ** tokenDecimals);
          }
          return 0;
        })(),
        (async () => {
          const pointsResponse = await fetch(`/api/users/points?address=${publicKey.toBase58()}`);
          if (pointsResponse.ok) {
            const pointsData = await pointsResponse.json();
            console.log('[AirdropInfoDisplay] User points data from API:', pointsData);
            return pointsData.points || 0;
          }
          console.warn("[AirdropInfoDisplay] Failed to fetch user points, status:", pointsResponse.status);
          return 0;
        })(),
        (async () => {
          const totalPointsResponse = await fetch('/api/stats/total-points');
          if (totalPointsResponse.ok) {
            const totalPointsData = await totalPointsResponse.json();
            return totalPointsData.totalCommunityPoints > 0 ? totalPointsData.totalCommunityPoints : null;
          }
          console.warn("Failed to fetch total community points, status:", totalPointsResponse.status);
          return null;
        })(),
        (async () => {
          const airdropCheckResponse = await fetch(`/api/check-airdrop?address=${publicKey.toBase58()}`);
          if (airdropCheckResponse.ok) {
            const airdropData = await airdropCheckResponse.json();
            if (typeof airdropData.AIRDROP === 'number') {
              return airdropData.AIRDROP;
            }
            console.warn("[AirdropInfoDisplay] Initial airdrop amount not a number:", airdropData.AIRDROP);
            return 0;
          }
          console.warn("[AirdropInfoDisplay] Failed to fetch initial airdrop allocation, status:", airdropCheckResponse.status);
          return 0;
        })()
      ]);

      if (balanceResult.status === 'fulfilled') {
        fetchedBalance = balanceResult.value;
      } else {
        console.warn("Failed to fetch DeFAI token balance:", balanceResult.reason);
        fetchedBalance = 0;
      }

      if (pointsResult.status === 'fulfilled') {
        fetchedUserPoints = pointsResult.value;
      } else {
        console.warn("Error fetching user points:", pointsResult.reason);
        fetchedUserPoints = 0;
      }

      if (totalPointsResult.status === 'fulfilled') {
        fetchedTotalCommunityPoints = totalPointsResult.value;
      } else {
        console.warn("Error fetching total community points:", totalPointsResult.reason);
      }

      if (initialAirdropResult.status === 'fulfilled') {
        setInitialAirdropAllocation(initialAirdropResult.value);
      } else {
        console.warn("[AirdropInfoDisplay] Error fetching initial airdrop allocation:", initialAirdropResult.reason);
        setInitialAirdropAllocation(0); // Default to 0 or null if preferred
      }

    } catch (err: any) {
      console.error("General error in fetchAirdropData:", err);
      fetchError = "Could not load airdrop information.";
    }

    setDefaiBalance(fetchedBalance);
    setUserPoints(fetchedUserPoints);
    setTotalCommunityPoints(fetchedTotalCommunityPoints);
    if (fetchError) setError(fetchError);

    setIsLoading(false);

  }, [connected, publicKey, session, connection, tokenMintAddress, tokenDecimals]);

  useEffect(() => {
    if (connected && publicKey && session?.user?.walletAddress && authStatus === 'authenticated') {
      if (!tokenMintAddress) {
        setError("DeFAI token mint address is not configured. Check NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS.");
        toast.error("Airdrop configuration error.");
        return;
      }
      fetchAirdropData();
    }
  }, [connected, publicKey, session, authStatus, fetchAirdropData, tokenMintAddress]);

  if (!connected || !publicKey || authStatus !== 'authenticated' || !session?.user?.walletAddress) {
    return onNotConnected ? <>{onNotConnected()}</> : null;
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-lg p-6 my-8 mx-auto bg-white border border-gray-200 rounded-xl shadow-lg text-center">
        <SparklesIcon className="w-12 h-12 mx-auto text-blue-500 animate-pulse mb-3" />
        <p className="text-gray-700">Loading your Airdrop Info...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg p-6 my-8 mx-auto bg-red-50 border border-red-200 rounded-xl shadow-lg text-center flex flex-col items-center">
        <ExclamationTriangleIcon className="w-12 h-12 mx-auto text-red-500 mb-3" />
        <p className="text-red-700 font-semibold">Airdrop Info Error</p>
        <p className="text-red-600 text-sm mt-1">{error}</p>
      </div>
    );
  }

  const pointsShare = 
    userPoints !== null && userPoints > 0 && totalCommunityPoints !== null && totalCommunityPoints > 0 
    ? (userPoints / totalCommunityPoints) * airdropPoolSize 
    : 0;
  
  const totalEstimatedAirdrop = (initialAirdropAllocation || 0) + (defaiBalance !== null ? defaiBalance : 0) + pointsShare;

  // Brand colors
  const headlineColor = "text-[#2A97F1]";
  const textColor = "text-black";
  const backgroundColor = "bg-white";
  const borderColor = "border-gray-200";
  const itemBackgroundColor = "bg-gray-50";
  const itemBorderColor = "border-gray-300";
  const accentTextColor = "text-[#2A97F1]"; // For shiny numbers, use the headline color or a specific shiny one

  const tierDisplayName = (tierKey: string) => {
    const name = tierKey
      .replace(/^airdrop_tier_/, '')
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    // Replace $AIR with the dynamic token label
    if (tierKey.includes('bronze')) return name.replace('Bronze', `Bronze (>10k ${TOKEN_LABEL_AIR})`);
    if (tierKey.includes('silver')) return name.replace('Silver', `Silver (>100k ${TOKEN_LABEL_AIR})`);
    if (tierKey.includes('gold')) return name.replace('Gold', `Gold (>1M ${TOKEN_LABEL_AIR})`);
    if (tierKey.includes('diamond')) return name.replace('Diamond', `Diamond (>10M ${TOKEN_LABEL_AIR})`);
    if (tierKey.includes('master')) return name.replace('Master', `Master (>100M ${TOKEN_LABEL_AIR})`);
    if (tierKey.includes('grandmaster')) return name.replace('Grandmaster', `Grandmaster (>500M ${TOKEN_LABEL_AIR})`);
    if (tierKey.includes('legend')) return name.replace('Legend', `Legend (1B ${TOKEN_LABEL_AIR})`);
    return name;
  };

  return (
    <div className={`w-full max-w-lg p-6 md:p-8 my-8 mx-auto ${backgroundColor} ${borderColor} rounded-2xl shadow-xl font-sans`}>
      {showTitle && (
        <div className="flex items-center justify-center mb-6">
          <GiftIcon className={`w-10 h-10 mr-3 ${accentTextColor}`} />
          <h2 className={`text-3xl font-bold font-orbitron ${headlineColor}`}>
            Your {TOKEN_LABEL_AIR} Airdrop Snapshot
          </h2>
        </div>
      )}
      
      <div className="space-y-5">
        <div className={`p-4 ${itemBackgroundColor} rounded-lg ${itemBorderColor} border flex items-center justify-between shadow-sm`}>
          <div className="flex items-center">
            <GiftIcon className={`w-7 h-7 mr-3 ${accentTextColor}`} />
            <span className={`${textColor} text-lg`}>Initial {TOKEN_LABEL_AIR} Allocation:</span>
          </div>
          <span className={`text-xl font-semibold ${accentTextColor} text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400`}>
            {initialAirdropAllocation !== null ? initialAirdropAllocation.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) : 'N/A'} {TOKEN_LABEL_AIR}
          </span>
        </div>

        <div className={`p-4 ${itemBackgroundColor} rounded-lg ${itemBorderColor} border flex items-center justify-between shadow-sm`}>
          <div className="flex items-center">
            <CurrencyDollarIcon className={`w-7 h-7 mr-3 ${accentTextColor}`} />
            <span className={`${textColor} text-lg`}>Your DeFAI Balance:</span>
          </div>
          <span className={`text-xl font-semibold ${accentTextColor} text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-400 to-cyan-400`}>
            {defaiBalance !== null ? defaiBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'N/A'} DeFAI
          </span>
        </div>

        <div className={`p-4 ${itemBackgroundColor} rounded-lg ${itemBorderColor} border flex items-center justify-between shadow-sm`}>
          <div className="flex items-center">
            <SparklesIcon className={`w-7 h-7 mr-3 ${accentTextColor}`} />
            <span className={`${textColor} text-lg`}>Your Current {TOKEN_LABEL_POINTS}:</span>
          </div>
          <span className={`text-xl font-semibold ${accentTextColor} text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-red-400`}>
            {userPoints !== null ? userPoints.toLocaleString() : 'N/A'}
          </span>
        </div>

        <div className={`text-center p-4 ${itemBackgroundColor} rounded-lg ${itemBorderColor} border shadow-sm`}>
          <div className={`flex items-center justify-center ${textColor} mb-2`}>
            <CalendarDaysIcon className="w-6 h-6 mr-2" />
            <span>Snapshot on: <strong className={`${accentTextColor}`}>{snapshotDateString}</strong></span>
          </div>
          <p className={`${textColor} text-sm leading-relaxed`}>
            If you hold DeFAI during the snapshot, you will receive <strong className={`${accentTextColor} text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-teal-400 to-emerald-400`}>{defaiBalance !== null ? defaiBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'your current'} {TOKEN_LABEL_AIR}</strong> tokens (1:1 with your DeFAI balance) <strong className={`${accentTextColor}`}>PLUS</strong> a share of the <strong className={`${accentTextColor} text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400`}>{(airdropPoolSize || 0).toLocaleString()} {TOKEN_LABEL_AIR}</strong> community pool based on your points!
          </p>
        </div>

        <div className={`p-5 ${backgroundColor} rounded-lg ${borderColor} border shadow-md`}>
          <h3 className={`text-lg font-semibold text-center ${headlineColor} mb-2`}>Estimated {TOKEN_LABEL_POINTS}-Based Airdrop:</h3>
          <p className={`text-3xl font-bold text-center ${accentTextColor} text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-500 mb-1`}>
            {pointsShare.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})} {TOKEN_LABEL_AIR}
          </p>
          {totalCommunityPoints === null && userPoints !== null && userPoints > 0 && (
            <p className={`text-xs text-center ${textColor} opacity-75`}>(Finalizing estimate based on total community points...)</p>
          )}
          {userPoints === 0 && (<p className={`text-xs text-center ${textColor} opacity-75`}>(Earn more points to increase this share!)</p>)}
        </div>

        <div className="pt-3 text-center">
          <p className={`${textColor} text-lg mb-1`}>Total Estimated <span className={`font-bold ${accentTextColor} text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-400`}>{TOKEN_LABEL_AIR}</span> Airdrop:</p>
          <p className={`text-5xl font-extrabold font-orbitron ${accentTextColor} text-transparent bg-clip-text bg-gradient-to-tr from-blue-400 via-sky-300 to-cyan-400 animate-pulse`}>
            {totalEstimatedAirdrop.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AirdropInfoDisplay; 