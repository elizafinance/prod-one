"use client";

// ALL CLIENT-SIDE IMPORTS now follow "use client"
import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import UserAvatar from '@/components/UserAvatar';

// INTERFACES AND CONSTANTS used by the Client Component
interface PublicProfileSquadInfo {
  squadId: string;
  name: string;
}
interface PublicProfileData {
  maskedWalletAddress: string;
  xUsername?: string;
  xProfileImageUrl?: string;
  points: number;
  highestAirdropTierLabel?: string;
  referralsMadeCount?: number;
  squadInfo?: PublicProfileSquadInfo | null;
  earnedBadgeIds?: string[];
}

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
const badgeDisplayMap: { [key: string]: { icon: string; label: string; color: string } } = {
  pioneer_badge: { icon: "🧭", label: "Pioneer", color: "bg-green-500 text-white" },
  legend_tier_badge: { icon: "🌟", label: "Legend Tier", color: "bg-yellow-500 text-black" },
};

// CLIENT COMPONENT DEFINITION
export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const walletAddress = params.walletAddress as string;
  const { publicKey } = useWallet();
  const loggedInUserWalletAddress = publicKey?.toBase58();

  const [profileData, setProfileData] = useState<PublicProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (walletAddress) {
      const fetchProfileData = async () => {
        setIsLoading(true); setError(null);
        try {
          const response = await fetch(`/api/users/public-profile/${walletAddress}`);
          if (!response.ok) {
            if (response.status === 404) throw new Error('User profile not found.');
            else throw new Error('Failed to fetch user profile.');
          }
          const data = await response.json();
          setProfileData(data);
        } catch (err) {
          setError((err as Error).message || 'Could not load profile.'); console.error(err);
        }
        setIsLoading(false);
      };
      fetchProfileData();
    }
  }, [walletAddress]);

  const handleShareToX = async () => { 
    if (!profileData) return;
    let shareText = `Check out this profile on DeFAI Rewards! Wallet: ${profileData.maskedWalletAddress}, Points: ${profileData.points.toLocaleString()}`;
    if (profileData.highestAirdropTierLabel) {
      shareText += `, Tier: ${profileData.highestAirdropTierLabel}`;
    }
    shareText += ` | @DeFAIRewards`;
    const profileUrl = window.location.href;
    const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(profileUrl)}`;
    
    window.open(twitterIntentUrl, '_blank');

    if (loggedInUserWalletAddress && loggedInUserWalletAddress === walletAddress) {
      try {
        toast.info('Checking for profile share bonus...');
        const response = await fetch('/api/actions/log-profile-share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress: loggedInUserWalletAddress }),
        });
        if (response.ok) {
          const result = await response.json();
          if (result.boostActivated) {
            toast.success("Referral Frenzy Boost Activated! Next 3 referrals get +50% points!");
          } else if (result.awardedPoints && result.awardedPoints > 0) {
            toast.success(`Successfully shared profile! +${result.awardedPoints} points.`);
          } else {
            toast.success('Profile share acknowledged!');
          }
        } else {
          const errorData = await response.json();
          toast.error(errorData.error || 'Failed to log profile share.');
        }
      } catch (error) {
        toast.error('Error logging profile share.');
      }
    }
  };

  // Loading, Error, and Not Found states JSX (simplified for brevity in instruction)
  if (isLoading) return <main className="flex flex-col items-center justify-center min-h-screen"><p>Loading Profile...</p></main>;
  if (error) return <main className="flex flex-col items-center justify-center min-h-screen"><p>Error: {error}</p><button onClick={() => router.back()}>Go Back</button></main>;
  if (!profileData) return <main className="flex flex-col items-center justify-center min-h-screen"><p>Profile not available.</p></main>;

  const tierStyleKey = profileData.highestAirdropTierLabel ? profileData.highestAirdropTierLabel.toLowerCase() : 'default';
  const currentTierStyle = tierStyles[tierStyleKey] || tierStyles.default;
  
  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="w-full max-w-2xl mx-auto my-10 bg-white/10 backdrop-blur-md shadow-2xl rounded-xl p-6 sm:p-10">
        
        <div className="flex flex-col items-center text-center mb-8">
          <UserAvatar 
            profileImageUrl={profileData.xProfileImageUrl} 
            username={profileData.xUsername}
            size="lg"
            className="mb-4"
          />
          <h1 className="text-4xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 mb-2">
            User Showcase
          </h1>
          <p className="text-lg text-gray-300 font-mono break-all">{profileData.maskedWalletAddress}</p>
          {profileData.xUsername && <p className="text-md text-gray-400">@{profileData.xUsername}</p>}
        </div>

        <div className="space-y-6">
          {/* Total Points */}
          <div className="p-6 bg-white/5 rounded-lg shadow-lg">
            <h2 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-1">Total Points</h2>
            <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-red-500">
              {profileData.points.toLocaleString()}
            </p>
          </div>
          {/* Airdrop Tier */}
          {profileData.highestAirdropTierLabel && (
            <div className="p-6 bg-white/5 rounded-lg shadow-lg">
              <h2 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-2">Airdrop Tier</h2>
              <span className={`px-4 py-2 text-lg font-bold rounded-full ${currentTierStyle}`}>
                {profileData.highestAirdropTierLabel}
              </span>
            </div>
          )}
          {/* Squad Info */}
           {profileData.squadInfo && (
            <div className="p-6 bg-white/5 rounded-lg shadow-lg">
              <h2 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-1">Squad Affiliation</h2>
              <Link href={`/squads/${profileData.squadInfo.squadId}`} passHref>
                <span className="text-xl font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer hover:underline">
                  🛡️ {profileData.squadInfo.name}
                </span>
              </Link>
            </div>
          )}
          {/* Badges */}
          {profileData.earnedBadgeIds && profileData.earnedBadgeIds.length > 0 && (
            <div className="p-6 bg-white/5 rounded-lg shadow-lg">
              <h2 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-2">Achievements</h2>
              <div className="flex flex-wrap gap-2">
                {profileData.earnedBadgeIds.map(badgeId => {
                  const badge = badgeDisplayMap[badgeId];
                  return badge ? (
                    <span key={badgeId} className={`px-3 py-1 text-xs font-semibold rounded-full ${badge.color}`}>
                      {badge.icon} {badge.label}
                    </span>
                  ) : (
                    <span key={badgeId} className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-600 text-gray-200">
                      {badgeId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} 
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {/* Referrals Made */}
          <div className="p-6 bg-white/5 rounded-lg shadow-lg">
            <h2 className="text-sm font-semibold text-purple-300 uppercase tracking-wider mb-1">Referrals Made</h2>
            <p className="text-3xl font-bold text-gray-100">
              {profileData.referralsMadeCount?.toLocaleString() || 0}
            </p>
          </div>
        </div>

        {/* Share Buttons */}
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