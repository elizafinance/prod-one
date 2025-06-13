"use client";

// ALL CLIENT-SIDE IMPORTS now follow "use client"
import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { PublicKey } from '@solana/web3.js';
import { getDefaiBalance } from '@/utils/tokenBalance';
import UserAvatar from '@/components/UserAvatar';
import ShareProfileButton from '@/components/ShareProfileButton';
import GlowingBadge from '@/components/GlowingBadge';
import AirdropInfoDisplay from "@/components/airdrop/AirdropInfoDisplay";
import FleekIntegrationPanel from '@/components/FleekIntegrationPanel';

// INTERFACES AND CONSTANTS used by the Client Component
interface PublicProfileSquadInfo {
  squadId: string;
  name: string;
}

interface ReferrerInfo {
  walletAddress: string;
  xUsername?: string;
  xProfileImageUrl?: string;
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
  referredBy?: ReferrerInfo;
}

const tierStyles: { [key: string]: string } = {
  default: 'bg-gray-300 text-gray-800',
  bronze: 'bg-orange-500 text-white border border-orange-600',
  silver: 'bg-slate-400 text-slate-900 border border-slate-500',
  gold: 'bg-yellow-400 text-yellow-900 border border-yellow-500',
  diamond: 'bg-sky-400 text-sky-900 border border-sky-500',
  master: 'bg-indigo-500 text-white border border-indigo-600',
  grandmaster: 'bg-purple-600 text-white border border-purple-700',
  legend: 'bg-pink-600 text-white border border-pink-700 font-bold italic',
};
const badgeDisplayMap: { [key: string]: { icon: string; label: string; color: string; isSpecial?: boolean; glowColor?: string } } = {
  pioneer_badge: { icon: "🧭", label: "Pioneer", color: "bg-green-600 text-white" },
  legend_tier_badge: { icon: "🌟", label: "Legend Tier", color: "bg-yellow-500 text-black" },
  generous_donor_badge: { 
    icon: "✨", 
    label: "Generous Donor", 
    color: "bg-violet-600 text-white", 
    isSpecial: true,
    glowColor: "rgba(139, 92, 246, 0.7)"
  },
};

// CLIENT COMPONENT DEFINITION
export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const walletAddress = params?.walletAddress as string || '';
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const loggedInUserWalletAddress = publicKey?.toBase58();

  const [profileData, setProfileData] = useState<PublicProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaiBalance, setDefaiBalance] = useState<number | null>(null);

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

  // Fetch DeFAI balance for own profile
  useEffect(() => {
    const isOwnProfile = loggedInUserWalletAddress === walletAddress;
    if (isOwnProfile && publicKey && connection) {
      const fetchDefaiBalance = async () => {
        try {
          const result = await getDefaiBalance(connection, publicKey);
          setDefaiBalance(result.balance);
          
          if (result.error) {
            console.warn("[Profile] DeFAI balance warning:", result.error);
          }
        } catch (e) {
          console.warn("[Profile] Could not fetch DeFAI balance:", e);
          setDefaiBalance(0);
        }
      };
      fetchDefaiBalance();
    }
  }, [loggedInUserWalletAddress, walletAddress, publicKey, connection]);

  // Loading, Error, and Not Found states JSX (simplified for brevity in instruction)
  if (isLoading) return <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground"><p>Loading Profile...</p></main>;
  if (error) return <main className="flex flex-col items-center justify-center min-h-screen bg-white text-red-700"><p>Error: {error}</p><button onClick={() => router.back()} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Go Back</button></main>;
  if (!profileData) return <main className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground"><p>Profile not available.</p></main>;

  const tierStyleKey = profileData.highestAirdropTierLabel ? profileData.highestAirdropTierLabel.toLowerCase() : 'default';
  const currentTierStyle = tierStyles[tierStyleKey] || tierStyles.default;
  const isOwnProfile = loggedInUserWalletAddress === walletAddress;
  
  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-background text-foreground">
      <div className="w-full max-w-2xl mx-auto my-10 bg-card border border-border shadow-xl rounded-xl p-6 sm:p-10">
        
        <div className="flex flex-col items-center text-center mb-8">
          <UserAvatar 
            profileImageUrl={profileData.xProfileImageUrl} 
            username={profileData.xUsername}
            size="lg"
            className="mb-4"
          />
          <h1 className="text-4xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-500 via-pink-600 to-red-600 mb-2">
            User Showcase
          </h1>
          <p className="text-lg text-foreground font-mono break-all">{profileData.maskedWalletAddress}</p>
          {profileData.xUsername && <p className="text-md text-muted-foreground">@{profileData.xUsername}</p>}
        </div>

        {/* Airdrop Info Display for Own Profile */}
        {isOwnProfile && (
          <div className="my-6">
            <AirdropInfoDisplay showTitle={false} defaiBalanceFetched={defaiBalance} />
          </div>
        )}

        <div className="space-y-6">
          {/* Total Points */}
          <div className="p-6 bg-muted border border-border rounded-lg shadow-md">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-1">Total Points</h2>
            <p className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-red-600">
              {profileData.points.toLocaleString()}
            </p>
          </div>
          {/* Airdrop Tier */}
          {profileData.highestAirdropTierLabel && (
            <div className="p-6 bg-muted border border-border rounded-lg shadow-md">
              <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-2">Airdrop Tier</h2>
              <span className={`px-4 py-2 text-lg font-bold rounded-full ${currentTierStyle}`}>
                {profileData.highestAirdropTierLabel}
              </span>
            </div>
          )}
          {/* Squad Info */}
           {profileData.squadInfo && (
            <div className="p-6 bg-muted border border-border rounded-lg shadow-md">
              <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-1">Squad Affiliation</h2>
              <Link href={`/squads/${profileData.squadInfo.squadId}`} passHref>
                <span className="text-xl font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer hover:underline">
                  🛡️ {profileData.squadInfo.name}
                </span>
              </Link>
            </div>
          )}
          {/* Badges */}
          {profileData.earnedBadgeIds && profileData.earnedBadgeIds.length > 0 && (
            <div className="p-6 bg-muted border border-border rounded-lg shadow-md">
              <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-2">Achievements</h2>
              <div className="flex flex-wrap gap-2">
                {profileData.earnedBadgeIds.map(badgeId => {
                  const badge = badgeDisplayMap[badgeId];
                  return badge ? (
                    badge.isSpecial ? (
                      <GlowingBadge
                        key={badgeId}
                        icon={badge.icon}
                        label={badge.label}
                        color={badge.color}
                        glowColor={badge.glowColor || "rgba(255, 255, 255, 0.5)"}
                        size="md"
                      />
                    ) : (
                      <span key={badgeId} className={`px-3 py-1 text-xs font-semibold rounded-full ${badge.color}`}>
                        {badge.icon} {badge.label}
                      </span>
                    )
                  ) : (
                    <span key={badgeId} className="px-3 py-1 text-xs font-semibold rounded-full bg-muted text-foreground">
                      {badgeId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} 
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {/* Referrals Made */}
          <div className="p-6 bg-muted border border-border rounded-lg shadow-md">
            <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-1">Referrals Made</h2>
            <p className="text-3xl font-bold text-foreground">
              {profileData.referralsMadeCount?.toLocaleString() || 0}
            </p>
          </div>
          {/* Referred By Info */}
          {profileData.referredBy && (
            <div className="p-6 bg-muted border border-border rounded-lg shadow-md">
              <h2 className="text-sm font-semibold text-purple-700 uppercase tracking-wider mb-2">Referred By</h2>
              <div className="flex items-center gap-3">
                <UserAvatar 
                  profileImageUrl={profileData.referredBy.xProfileImageUrl} 
                  username={profileData.referredBy.xUsername}
                  size="sm"
                />
                <div>
                  {profileData.referredBy.xUsername ? (
                    <span className="text-md text-foreground">@{profileData.referredBy.xUsername}</span>
                  ) : (
                    <span className="text-md text-foreground font-mono">{profileData.referredBy.walletAddress}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Share Buttons */}
        <div className="mt-10 text-center">
          <div className="flex flex-wrap justify-center gap-3">
            <ShareProfileButton 
              walletAddress={walletAddress}
              username={profileData.xUsername}
              points={profileData.points}
              airdropTier={profileData.highestAirdropTierLabel}
            />
            <Link href="/leaderboard" passHref>
              <button className="bg-[#2B96F1] hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out text-lg">
                View Leaderboard
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Fleek Storage Integration */}
      <div className="w-full max-w-2xl mx-auto">
        <FleekIntegrationPanel />
      </div>
    </main>
  );
} 