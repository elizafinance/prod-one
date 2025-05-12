"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation'; // useRouter for back button
import Link from 'next/link'; // For a link back to home or leaderboard

interface PublicProfileData {
  maskedWalletAddress: string;
  xUsername?: string;
  points: number;
  highestAirdropTierLabel?: string;
  referralsMadeCount?: number;
}

// Tier styles mapping - reusing from leaderboard for consistency, adjust as needed
const tierStyles: { [key: string]: string } = {
  default: 'bg-gray-500 text-gray-100',
  bronze: 'bg-orange-500 text-white border border-orange-400',
  silver: 'bg-slate-400 text-slate-800 border border-slate-500',
  gold: 'bg-yellow-500 text-yellow-900 border border-yellow-600',
  diamond: 'bg-sky-400 text-sky-900 border border-sky-500',
  master: 'bg-indigo-500 text-white border border-indigo-400',
  grandmaster: 'bg-purple-600 text-white border border-purple-500',
  legend: 'bg-pink-600 text-white border border-pink-500 font-bold italic',
};

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const walletAddress = params.walletAddress as string;

  const [profileData, setProfileData] = useState<PublicProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (walletAddress) {
      const fetchProfileData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch(`/api/users/public-profile/${walletAddress}`);
          if (!response.ok) {
            if (response.status === 404) {
              throw new Error('User profile not found.');
            } else {
              throw new Error('Failed to fetch user profile.');
            }
          }
          const data = await response.json();
          setProfileData(data);
        } catch (err) {
          setError((err as Error).message || 'Could not load profile.');
          console.error(err);
        }
        setIsLoading(false);
      };
      fetchProfileData();
    }
  }, [walletAddress]);

  const handleShareToX = () => {
    if (!profileData) return;
    let shareText = `Check out this profile on DeFAI Rewards! Wallet: ${profileData.maskedWalletAddress}, Points: ${profileData.points.toLocaleString()}`;
    if (profileData.highestAirdropTierLabel) {
      shareText += `, Tier: ${profileData.highestAirdropTierLabel}`;
    }
    shareText += ` | @DeFAIRewards`; // Add your platform's Twitter handle
    const profileUrl = window.location.href;
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`;
    window.open(twitterIntentUrl, '_blank');
  };

  if (isLoading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-gray-900 to-gray-800 text-white">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-500"></div>
        <p className="mt-4 text-xl">Loading Profile...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-gray-900 to-gray-800 text-white">
        <div className="text-center bg-red-900 bg-opacity-50 p-8 rounded-lg shadow-xl">
          <h1 className="text-3xl font-bold mb-4 text-red-400">Error</h1>
          <p className="text-lg text-red-300">{error}</p>
          <button 
            onClick={() => router.back()} 
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out"
          >
            Go Back
          </button>
        </div>
      </main>
    );
  }

  if (!profileData) {
    // This case should ideally be covered by the error state if fetch fails or user not found
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-gray-900 to-gray-800 text-white">
        <p className="text-xl">Profile not available.</p>
      </main>
    );
  }

  const tierStyleKey = profileData.highestAirdropTierLabel ? profileData.highestAirdropTierLabel.toLowerCase() : 'default';
  const currentTierStyle = tierStyles[tierStyleKey] || tierStyles.default;

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="w-full max-w-2xl mx-auto my-10 bg-white/10 backdrop-blur-md shadow-2xl rounded-xl p-6 sm:p-10">
        
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 mb-2">
            User Showcase
          </h1>
          <p className="text-lg text-gray-300 font-mono break-all">{profileData.maskedWalletAddress}</p>
          {profileData.xUsername && <p className="text-md text-gray-400">@{profileData.xUsername}</p>}
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-white/5 rounded-lg shadow-lg">
            <h2 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-1">Total Points</h2>
            <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-red-500">
              {profileData.points.toLocaleString()}
            </p>
          </div>

          {profileData.highestAirdropTierLabel && (
            <div className="p-6 bg-white/5 rounded-lg shadow-lg">
              <h2 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-2">Airdrop Tier</h2>
              <span className={`px-4 py-2 text-lg font-bold rounded-full ${currentTierStyle}`}>
                {profileData.highestAirdropTierLabel}
              </span>
            </div>
          )}

          <div className="p-6 bg-white/5 rounded-lg shadow-lg">
            <h2 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-1">Referrals Made</h2>
            <p className="text-3xl font-bold text-gray-100">
              {profileData.referralsMadeCount?.toLocaleString() || 0}
            </p>
          </div>
        </div>

        <div className="mt-10 text-center space-x-4">
          <button
            onClick={handleShareToX}
            className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out text-lg"
          >
            🚀 Share on X
          </button>
          <Link href="/leaderboard" passHref>
            <button className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out text-lg">
              View Leaderboard
            </button>
          </Link>
        </div>

      </div>
    </main>
  );
} 