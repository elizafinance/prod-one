/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { toast } from 'sonner';
import { SparklesIcon, CurrencyDollarIcon, GiftIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { useSession } from 'next-auth/react';

interface AirdropInfoDisplayProps {
  onNotConnected?: () => React.ReactNode; // Optional: Render prop/component when not connected
  showTitle?: boolean;
}

const AirdropInfoDisplay: React.FC<AirdropInfoDisplayProps> = ({ onNotConnected, showTitle = true }) => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const { data: session, status: authStatus } = useSession();

  const [defaiBalance, setDefaiBalance] = useState<number | null>(null);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [totalCommunityPoints, setTotalCommunityPoints] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenMintAddress = process.env.NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS;
  const tokenDecimals = parseInt(process.env.NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS || '9', 10);
  const snapshotDateString = process.env.NEXT_PUBLIC_AIRDROP_SNAPSHOT_DATE_STRING || "May 20th";
  const airdropPoolSize = parseInt(process.env.NEXT_PUBLIC_AIRDROP_POINTS_POOL_SIZE || '1000000000', 10);
  const airdropTokenSymbol = process.env.NEXT_PUBLIC_AIRDROP_TOKEN_SYMBOL || "AIR";

  const fetchAirdropData = useCallback(async () => {
    if (!connected || !publicKey || !session?.user?.walletAddress) {
      // Don't set error, just clear data if user disconnects
      setDefaiBalance(null);
      setUserPoints(null);
      // totalCommunityPoints can remain fetched if we want to show general pool info
      // but for user-specific calculation, it's better to clear or handle it appropriately.
      return;
    }
    
    setIsLoading(true);
    setError(null);

    let fetchedBalance: number | null = null;
    let fetchedUserPoints: number | null = null;
    let fetchedTotalCommunityPoints: number | null = null;

    try {
      // 1. Fetch DeFAI Balance
      if (tokenMintAddress) {
        try {
          const mint = new PublicKey(tokenMintAddress);
          const ata = await getAssociatedTokenAddress(mint, publicKey);
          const accountInfo = await getAccount(connection, ata, 'confirmed');
          fetchedBalance = Number(accountInfo.amount) / (10 ** tokenDecimals);
        } catch (e) {
          console.warn("Failed to fetch DeFAI token balance:", e);
          fetchedBalance = 0; // Assume 0 if account not found or other error
        }
      }

      // 2. Fetch User Points
      try {
        const pointsResponse = await fetch(`/api/users/points?walletAddress=${publicKey.toBase58()}`);
        if (pointsResponse.ok) {
          const pointsData = await pointsResponse.json();
          fetchedUserPoints = pointsData.points || 0;
        } else {
          console.warn("Failed to fetch user points");
          fetchedUserPoints = 0;
        }
      } catch (e) {
        console.warn("Error fetching user points:", e);
        fetchedUserPoints = 0;
      }

      // 3. Fetch Total Community Points
      try {
        const totalPointsResponse = await fetch('/api/stats/total-points');
        if (totalPointsResponse.ok) {
          const totalPointsData = await totalPointsResponse.json();
          fetchedTotalCommunityPoints = totalPointsData.totalCommunityPoints > 0 ? totalPointsData.totalCommunityPoints : null;
        } else {
          console.warn("Failed to fetch total community points");
        }
      } catch (e) {
        console.warn("Error fetching total community points:", e);
      }
      
      setDefaiBalance(fetchedBalance);
      setUserPoints(fetchedUserPoints);
      setTotalCommunityPoints(fetchedTotalCommunityPoints);

    } catch (err: any) {
      console.error("Error fetching airdrop data:", err);
      setError("Could not load airdrop information.");
      toast.error("Failed to load airdrop details.");
    } finally {
      setIsLoading(false);
    }
  }, [connected, publicKey, session, connection, tokenMintAddress, tokenDecimals]);

  useEffect(() => {
    if (connected && publicKey && session?.user?.walletAddress && authStatus === 'authenticated') {
      if (!tokenMintAddress) {
        setError("DeFAI token mint address is not configured.");
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
      <div className="w-full max-w-md p-6 my-6 bg-gradient-to-br from-slate-800 to-gray-900 border border-slate-700 rounded-xl shadow-2xl text-center">
        <SparklesIcon className="w-12 h-12 mx-auto text-yellow-400 animate-pulse mb-3" />
        <p className="text-slate-300">Loading your Airdrop Info...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-md p-6 my-6 bg-red-800 border border-red-700 rounded-xl shadow-lg text-center">
        <p className="text-red-200">Error: {error}</p>
      </div>
    );
  }

  const pointsShare = 
    userPoints !== null && totalCommunityPoints !== null && totalCommunityPoints > 0 
    ? (userPoints / totalCommunityPoints) * airdropPoolSize 
    : 0;
  
  const totalEstimatedAirdrop = (defaiBalance || 0) + pointsShare;

  return (
    <div className="w-full max-w-lg p-6 md:p-8 my-8 bg-gradient-to-tr from-blue-900 via-indigo-900 to-purple-900 border border-indigo-700 rounded-2xl shadow-2xl text-white font-sans">
      {showTitle && (
        <div className="flex items-center justify-center mb-6">
          <GiftIcon className="w-10 h-10 mr-3 text-yellow-400" />
          <h2 className="text-3xl font-bold font-orbitron text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500">
            Your {airdropTokenSymbol} Airdrop Snapshot
          </h2>
        </div>
      )}
      
      <div className="space-y-5">
        <div className="p-4 bg-black/30 rounded-lg border border-indigo-600/50 flex items-center justify-between">
          <div className="flex items-center">
            <CurrencyDollarIcon className="w-7 h-7 mr-3 text-green-400" />
            <span className="text-slate-300 text-lg">Your DeFAI Balance:</span>
          </div>
          <span className="text-xl font-semibold text-green-300">
            {defaiBalance !== null ? defaiBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'N/A'} DeFAI
          </span>
        </div>

        <div className="p-4 bg-black/30 rounded-lg border border-indigo-600/50 flex items-center justify-between">
          <div className="flex items-center">
            <SparklesIcon className="w-7 h-7 mr-3 text-pink-400" />
            <span className="text-slate-300 text-lg">Your Current Points:</span>
          </div>
          <span className="text-xl font-semibold text-pink-300">
            {userPoints !== null ? userPoints.toLocaleString() : 'N/A'}
          </span>
        </div>

        <div className="text-center p-4 bg-black/20 rounded-lg border border-purple-700/50">
          <div className="flex items-center justify-center text-slate-400 mb-2">
            <CalendarDaysIcon className="w-6 h-6 mr-2" />
            <span>Snapshot on: <strong className="text-purple-300">{snapshotDateString}</strong></span>
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            If you hold DeFAI during the snapshot, you will receive <strong className="text-green-400">{defaiBalance !== null ? defaiBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'your current'} {airdropTokenSymbol}</strong> tokens (1:1 with your DeFAI balance) <strong className="text-yellow-300">PLUS</strong> a share of the <strong className="text-yellow-400">{(airdropPoolSize || 0).toLocaleString()} {airdropTokenSymbol}</strong> community pool based on your points!
          </p>
        </div>

        <div className="p-5 bg-gradient-to-r from-purple-800 via-fuchsia-800 to-pink-800 rounded-lg border border-fuchsia-600/70 shadow-lg">
          <h3 className="text-lg font-semibold text-center text-yellow-200 mb-2">Estimated Points-Based Airdrop:</h3>
          <p className="text-3xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-orange-500 mb-1">
            {pointsShare.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})} {airdropTokenSymbol}
          </p>
          {totalCommunityPoints === null && userPoints !== null && (
            <p className="text-xs text-center text-purple-300">(Waiting for total community points data to finalize estimate)</p>
          )}
          {userPoints === 0 && (<p className="text-xs text-center text-purple-300">(Earn more points to increase this share!)</p>)}
        </div>

        <div className="pt-3 text-center">
          <p className="text-slate-400 text-lg mb-1">Total Estimated <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-teal-400">{airdropTokenSymbol}</span> Airdrop:</p>
          <p className="text-5xl font-extrabold font-orbitron text-transparent bg-clip-text bg-gradient-to-tr from-sky-300 via-cyan-300 to-emerald-400 animate-pulse">
            {totalEstimatedAirdrop.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AirdropInfoDisplay; 