'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useSession } from 'next-auth/react';
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Vote, 
  Calendar, 
  User, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ArrowLeft
} from "lucide-react";
import ProposalCard, { ProposalCardData } from '@/components/proposals/ProposalCard';
import VoteModal from '@/components/modals/VoteModal';

interface PageProps {
  params: {
    proposalId: string;
  };
}

export default function ProposalDetailPage({ params }: PageProps) {
  const { proposalId } = params;

  const [proposal, setProposal] = useState<ProposalCardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [currentUserPoints, setCurrentUserPoints] = useState<number | null>(null);
  const { data: session, status: sessionStatus } = useSession<any>();
  const typedSession: any = session;

  const fetchProposal = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proposals/${proposalId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch proposal');
      }
      const data: ProposalCardData = await res.json();
      setProposal(data);
    } catch (err: any) {
      console.error('[ProposalDetail] Fetch error:', err);
      setError(err.message);
      toast.error(err.message || 'Unable to load proposal');
    } finally {
      setIsLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  // Fetch current user points
  useEffect(() => {
    if (sessionStatus === 'authenticated' && typedSession?.user?.walletAddress) {
      const address = typedSession.user.walletAddress;
      fetch(`/api/users/points?address=${address}`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`Failed to fetch points (${res.status})`);
          return res.json();
        })
        .then((data) => {
          if (typeof data.points === 'number') setCurrentUserPoints(data.points);
          else setCurrentUserPoints(null);
        })
        .catch((err) => {
          console.warn('[ProposalDetail] Could not get user points:', err);
          setCurrentUserPoints(null);
        });
    } else if (sessionStatus === 'unauthenticated') {
      setCurrentUserPoints(null);
    }
  }, [sessionStatus, typedSession?.user?.walletAddress]);

  const handleVoteSuccess = () => {
    fetchProposal();
  };

  const openVoteModal = () => setIsVoteModalOpen(true);
  const closeVoteModal = () => setIsVoteModalOpen(false);

  const getProposalStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <Clock className="h-4 w-4" />;
      case 'passed':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Vote className="h-4 w-4" />;
    }
  };

  const getProposalStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'default';
      case 'passed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'cancelled':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  if (error) {
    return (
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/proposals">Proposals</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Error</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/proposals">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Proposals
              </Link>
            </Button>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Proposal not found.'}
            </AlertDescription>
          </Alert>
        </div>
      </SidebarInset>
    );
  }

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbLink href="/proposals">Proposals</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {isLoading ? "Loading..." : proposal?.title || "Proposal Details"}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/proposals">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Proposals
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {/* Loading skeleton for proposal stats */}
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-3 w-24 mt-1" />
                  </CardContent>
                </Card>
              ))}
            </div>
            {/* Loading skeleton for main proposal card */}
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          </div>
        ) : proposal ? (
          <div className="space-y-6">
            {/* Proposal Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Status</CardTitle>
                  {getProposalStatusIcon(proposal.status)}
                </CardHeader>
                <CardContent>
                  <Badge variant={getProposalStatusVariant(proposal.status) as any} className="flex items-center gap-1">
                    {proposal.status}
                  </Badge>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
                  <Vote className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {(proposal.yesVotes || 0) + (proposal.noVotes || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">votes cast</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Yes Votes</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {proposal.yesVotes || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {proposal.yesVotes && proposal.noVotes 
                      ? `${Math.round((proposal.yesVotes / (proposal.yesVotes + proposal.noVotes)) * 100)}%`
                      : '0%'
                    }
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">No Votes</CardTitle>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {proposal.noVotes || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {proposal.yesVotes && proposal.noVotes 
                      ? `${Math.round((proposal.noVotes / (proposal.yesVotes + proposal.noVotes)) * 100)}%`
                      : '0%'
                    }
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Main Proposal Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{proposal.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 mt-2">
                      <User className="h-4 w-4" />
                      Created by {proposal.createdByWalletAddress?.substring(0, 8)}...
                      <Calendar className="h-4 w-4 ml-4" />
                      {new Date(proposal.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge variant={getProposalStatusVariant(proposal.status) as any}>
                    {proposal.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ProposalCard 
                  proposal={proposal} 
                  onVoteClick={openVoteModal} 
                  currentUserPoints={currentUserPoints} 
                />
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      {proposal && (
        <VoteModal
          isOpen={isVoteModalOpen}
          onClose={closeVoteModal}
          proposal={proposal}
          onVoteSuccess={handleVoteSuccess}
          currentUserPoints={currentUserPoints}
        />
      )}
    </SidebarInset>
  );
}