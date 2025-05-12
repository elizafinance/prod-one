"use client";

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { SquadDocument } from '@/lib/mongodb';

interface MySquadData extends SquadDocument {}

export default function MySquadPage() {
  const { publicKey, connected } = useWallet();
  const { data: session, status: authStatus } = useSession();
  const [mySquadData, setMySquadData] = useState<MySquadData | null>(null);
  const [isFetchingSquad, setIsFetchingSquad] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMySquadData = useCallback(async (userWalletAddress: string) => {
    if (!userWalletAddress || isFetchingSquad) return;
    setIsFetchingSquad(true);
    setError(null);
    console.log("[MySquadPage] Fetching squad data for:", userWalletAddress);
    try {
      const response = await fetch(`/api/squads/my-squad?userWalletAddress=${encodeURIComponent(userWalletAddress)}`);
      const data = await response.json();
      if (response.ok) {
        if (data.squad) {
          console.log("[MySquadPage] Squad data received:", data.squad);
          setMySquadData(data.squad as MySquadData);
        } else {
          console.log("[MySquadPage] User not in a squad or no squad data.");
          setMySquadData(null);
        }
      } else {
        console.error("[MySquadPage] Failed to fetch squad data:", data.error || response.statusText);
        setError(data.error || response.statusText);
        setMySquadData(null);
      }
    } catch (error) {
      console.error("[MySquadPage] Error fetching squad data:", error);
      setError((error as Error).message);
      setMySquadData(null);
    }
    setIsFetchingSquad(false);
  }, [isFetchingSquad]);

  useEffect(() => {
    if (connected && publicKey) {
      fetchMySquadData(publicKey.toBase58());
    }
  }, [connected, publicKey, fetchMySquadData]);

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="w-full max-w-md p-5 bg-indigo-50 border border-indigo-200 rounded-xl shadow-md mt-8 mb-4">
        <h3 className="text-xl font-bold text-indigo-700 mb-3 text-center">🛡️ My Squad</h3>
        {isFetchingSquad && <p className="text-center text-indigo-600">Loading squad info...</p>}
        {error && <p className="text-center text-red-600 bg-red-100 p-2 rounded">Error: {error}</p>}
        {!isFetchingSquad && mySquadData && (
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-800">Name: <span className="text-indigo-600 font-bold">{mySquadData.name}</span></p>
            <p className="text-sm text-gray-600">Total Points: <span className="font-semibold">{mySquadData.totalSquadPoints.toLocaleString()}</span></p>
            <p className="text-sm text-gray-600">Members: <span className="font-semibold">{mySquadData.memberWalletAddresses.length} / {process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || 10}</span></p>
            <Link href={`/squads/${mySquadData.squadId}`} passHref>
              <button className="mt-3 py-2 px-4 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors w-full shadow hover:shadow-md">
                View Squad Details
              </button>
            </Link>
          </div>
        )}
        {!isFetchingSquad && !mySquadData && !error && (
          <p className="text-center text-gray-600">You are not currently in a squad.</p>
        )}
        <div className="mt-6 text-center">
          <Link href="/">
            <button className="py-2 px-4 bg-gray-400 hover:bg-gray-500 text-white text-sm font-semibold rounded-lg transition-colors w-full shadow hover:shadow-md">
              Back to Dashboard
            </button>
          </Link>
        </div>
      </div>
    </main>
  );
} 