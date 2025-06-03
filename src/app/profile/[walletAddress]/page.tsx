"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { User, Trophy, Users, Star, Award, ExternalLink, Share2, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
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

  if (isLoading) return (
    <SidebarInset>
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3366FF]"></div>
        <p className='ml-3'>Loading profile...</p>
      </div>
    </SidebarInset>
  );
  
  if (error) return (
    <SidebarInset>
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p className="text-lg text-destructive mb-4">Error: {error}</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    </SidebarInset>
  );
  
  if (!profileData) return (
    <SidebarInset>
      <div className="flex flex-col items-center justify-center min-h-screen">
        <p>Profile not available.</p>
      </div>
    </SidebarInset>
  );

  const tierStyleKey = profileData.highestAirdropTierLabel ? profileData.highestAirdropTierLabel.toLowerCase() : 'default';
  const currentTierStyle = tierStyles[tierStyleKey] || tierStyles.default;
  const isOwnProfile = loggedInUserWalletAddress === walletAddress;
  
  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Platform</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink href="/profile">Profile</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {profileData.xUsername ? `@${profileData.xUsername}` : `${profileData.maskedWalletAddress}`}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto flex items-center gap-4 px-4">
          <ShareProfileButton 
            walletAddress={walletAddress}
            username={profileData.xUsername}
            points={profileData.points}
            airdropTier={profileData.highestAirdropTierLabel}
          />
        </div>
      </header>

      <main className="flex-1 py-6">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6">
            {/* Profile Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-6">
                  <UserAvatar 
                    profileImageUrl={profileData.xProfileImageUrl} 
                    username={profileData.xUsername}
                    size="lg"
                  />
                  <div className="flex-1">
                    <CardTitle className="text-3xl">
                      {profileData.xUsername ? `@${profileData.xUsername}` : 'User Profile'}
                    </CardTitle>
                    <CardDescription className="font-mono text-sm mt-1">
                      {profileData.maskedWalletAddress}
                    </CardDescription>
                    {isOwnProfile && (
                      <Badge variant="secondary" className="mt-2">Your Profile</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Airdrop Info Display for Own Profile */}
            {isOwnProfile && (
              <Card>
                <CardContent className="p-6">
                  <AirdropInfoDisplay showTitle={false} />
                </CardContent>
              </Card>
            )}

            {/* Profile Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Points</CardTitle>
                  <Star className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{profileData.points.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">DeFAI Points earned</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Airdrop Tier</CardTitle>
                  <Crown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {profileData.highestAirdropTierLabel || 'None'}
                  </div>
                  <p className="text-xs text-muted-foreground">Current tier status</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Referrals Made</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {profileData.referralsMadeCount?.toLocaleString() || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Users referred</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Achievements</CardTitle>
                  <Award className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {profileData.earnedBadgeIds?.length || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Badges earned</p>
                </CardContent>
              </Card>
            </div>

            {/* Squad Information */}
            {profileData.squadInfo && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Squad Affiliation
                  </CardTitle>
                  <CardDescription>Current squad membership</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href={`/squads/${profileData.squadInfo.squadId}`}>
                    <div className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/5 transition-colors">
                      <div className="text-2xl">🛡️</div>
                      <div>
                        <p className="font-semibold text-[#3366FF] hover:text-[#2952cc]">
                          {profileData.squadInfo.name}
                        </p>
                        <p className="text-sm text-muted-foreground">View squad details</p>
                      </div>
                      <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                    </div>
                  </Link>
                </CardContent>
              </Card>
            )}
            {/* Badges & Achievements */}
            {profileData.earnedBadgeIds && profileData.earnedBadgeIds.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Achievements & Badges
                  </CardTitle>
                  <CardDescription>Special recognition and accomplishments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
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
                          <Badge key={badgeId} variant="outline" className="gap-1">
                            <span>{badge.icon}</span>
                            <span>{badge.label}</span>
                          </Badge>
                        )
                      ) : (
                        <Badge key={badgeId} variant="secondary">
                          {badgeId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Referral Information */}
            {profileData.referredBy && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Referred By
                  </CardTitle>
                  <CardDescription>The user who referred this member</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <UserAvatar 
                      profileImageUrl={profileData.referredBy.xProfileImageUrl} 
                      username={profileData.referredBy.xUsername}
                      size="sm"
                    />
                    <div>
                      <p className="font-medium">
                        {profileData.referredBy.xUsername ? 
                          `@${profileData.referredBy.xUsername}` : 
                          profileData.referredBy.walletAddress
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">Referrer</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Explore more features and view community rankings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Button asChild className="bg-[#3366FF] hover:bg-[#2952cc]">
                    <Link href="/leaderboard">
                      <Trophy className="h-4 w-4 mr-2" />
                      View Leaderboard
                    </Link>
                  </Button>
                  
                  {profileData.squadInfo && (
                    <Button variant="outline" asChild>
                      <Link href={`/squads/${profileData.squadInfo.squadId}`}>
                        <Users className="h-4 w-4 mr-2" />
                        Visit Squad
                      </Link>
                    </Button>
                  )}
                  
                  {!isOwnProfile && (
                    <Button variant="outline">
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Profile
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Fleek Storage Integration */}
            {isOwnProfile && (
              <Card>
                <CardContent className="p-6">
                  <FleekIntegrationPanel />
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </SidebarInset>
  );
} 