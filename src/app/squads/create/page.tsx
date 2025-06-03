"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react'; // To ensure user has a wallet connected
import { toast } from 'sonner';
import Link from 'next/link';
import { TOKEN_LABEL_POINTS } from '@/lib/labels';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Users, Trophy, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

export default function CreateSquadPage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  
  const [squadName, setSquadName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [pointsLoading, setPointsLoading] = useState(true);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [tierRequirements, setTierRequirements] = useState<{ 
    tiers: Array<{ tier: number, minPoints: number, maxMembers: number }>,
    minRequiredPoints: number 
  } | null>(null);
  const [isFetchingTiers, setIsFetchingTiers] = useState(true);

  // Fetch tier requirements from the server
  useEffect(() => {
    async function fetchTierRequirements() {
      setIsFetchingTiers(true);
      try {
        const res = await fetch('/api/squads/tier-requirements');
        const data = await res.json();
        if (res.ok) {
          setTierRequirements(data);
        }
      } catch (err) {
        console.error("Failed to fetch tier requirements:", err);
      }
      setIsFetchingTiers(false);
    }
    
    fetchTierRequirements();
  }, []);

  useEffect(() => {
    async function fetchPoints() {
      setPointsLoading(true);
      setPointsError(null);
      if (connected && publicKey) {
        try {
          const res = await fetch(`/api/users/points?address=${publicKey.toBase58()}`);
          const data = await res.json();
          if (res.ok && typeof data.points === 'number') {
            setUserPoints(data.points);
            setPointsLoading(false);
            return;
          } else {
            setPointsError(data.error || 'Could not fetch points from server.');
          }
        } catch (err) {
          setPointsError('Could not fetch points from server.');
        }
      }
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem('defaiUserData');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (typeof parsed.points === 'number') {
            setUserPoints(parsed.points);
            setPointsLoading(false);
            return;
          }
        }
      } catch {}
      setPointsLoading(false);
      setPointsError('Could not determine your points. Please visit the Dashboard.');
    }
    fetchPoints();
  }, [connected, publicKey]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!connected || !publicKey) {
      toast.error('Please connect your wallet to create a squad.');
      setIsLoading(false);
      return;
    }

    if (!squadName.trim()) {
      toast.error('Squad name is required.');
      setIsLoading(false);
      return;
    }

    try {
      // The backend /api/squads/create now uses session for leaderWalletAddress
      const response = await fetch('/api/squads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadName, description }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Squad created successfully!');
        router.push('/'); 
      } else {
        setError(data.error || 'Failed to create squad.');
        toast.error(data.error || 'Failed to create squad.');
      }
    } catch (err) {
      console.error("Create squad error:", err);
      setError('An unexpected error occurred.');
      toast.error('An unexpected error occurred while creating the squad.');
    }
    setIsLoading(false);
  };

  const canCreate = !pointsLoading && userPoints !== null && 
    tierRequirements !== null && userPoints >= tierRequirements.minRequiredPoints;

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">
                  Dashboard
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink href="/squads">
                  Squads
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Create Squad</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Create Squad</h1>
          <Link href="/squads/browse">
            <Button variant="outline">
              <Users className="h-4 w-4 mr-2" />
              Browse Squads
            </Button>
          </Link>
        </div>

        <div className="max-w-2xl mx-auto w-full space-y-6">

          {pointsLoading && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Checking eligibility...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {!pointsLoading && !canCreate && (
            <Card className="border-destructive bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Insufficient Points
                </CardTitle>
                <CardDescription>
                  You need at least {tierRequirements?.minRequiredPoints?.toLocaleString() || '1,000'} DeFAI {TOKEN_LABEL_POINTS} to create a squad.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Your Points</span>
                      <span className="font-medium">{userPoints !== null ? userPoints.toLocaleString() : 'Loading...'}</span>
                    </div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Required</span>
                      <span className="font-medium">{tierRequirements?.minRequiredPoints?.toLocaleString() || '1,000'}</span>
                    </div>
                    <Progress 
                      value={userPoints && tierRequirements ? (userPoints / tierRequirements.minRequiredPoints) * 100 : 0} 
                      className="h-2"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Squad Tiers</h4>
                    <div className="space-y-1">
                      {tierRequirements?.tiers.map(tier => (
                        <div key={tier.tier} className="flex justify-between text-sm">
                          <span>{tier.minPoints.toLocaleString()} {TOKEN_LABEL_POINTS}</span>
                          <span className="text-muted-foreground">Up to {tier.maxMembers} members</span>
                        </div>
                      )) || (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>1,000 {TOKEN_LABEL_POINTS}</span>
                            <span className="text-muted-foreground">Up to 10 members</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>5,000 {TOKEN_LABEL_POINTS}</span>
                            <span className="text-muted-foreground">Up to 50 members</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>10,000 {TOKEN_LABEL_POINTS}</span>
                            <span className="text-muted-foreground">Up to 100 members</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {canCreate && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Eligible to Create Squad
                </CardTitle>
                <CardDescription>
                  You have {userPoints?.toLocaleString()} points and can create a squad
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Squad Details</CardTitle>
              <CardDescription>
                Fill in the information for your new squad
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="squadName">
                    Squad Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="squadName"
                    value={squadName}
                    onChange={(e) => setSquadName(e.target.value)}
                    placeholder="The Legends"
                    maxLength={30}
                    required
                    disabled={!canCreate || pointsLoading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="A brief description of your squad's mission..."
                    maxLength={150}
                    disabled={!canCreate || pointsLoading}
                  />
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isLoading || !connected || !canCreate || pointsLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Squad...
                    </>
                  ) : pointsLoading ? (
                    'Checking...'
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Create Squad
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarInset>
  );
} 