'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Vote, Clock, Users, TrendingUp, ChevronDown, Filter, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import VoteModal from '@/components/modals/VoteModal';
import { useSession } from 'next-auth/react';
import { formatPoints } from '@/lib/utils';

interface ProposalCardData {
  _id: string;
  title: string;
  description: string;
  proposer: string;
  squadId: {
    squadId: string;
    name: string;
  };
  status: string;
  tokenReward: number;
  epochStart: number;
  epochEnd: number;
  upVoteWeight: number;
  downVoteWeight: number;
  abstainVoteWeight: number;
  totalEngagedWeight: number;
  uniqueVoterCount: number;
  broadcasted: boolean;
  slug: string;
  createdAt: string;
}

interface ApiResponse {
  proposals: ProposalCardData[];
  currentPage: number;
  totalPages: number;
  totalProposals: number;
}

const PROPOSALS_REFRESH_INTERVAL = parseInt(process.env.NEXT_PUBLIC_PROPOSALS_REFRESH_INTERVAL || "30000", 10);

export default function ProposalsPage() {
  const [apiResponse, setApiResponse] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTab, setSelectedTab] = useState("active");
  const [selectedSort, setSelectedSort] = useState("newest");
  const proposalsPerPage = parseInt(process.env.NEXT_PUBLIC_PROPOSALS_PER_PAGE || "10", 10);

  const [currentUserPoints, setCurrentUserPoints] = useState<number | null>(null);
  const { data: session, status: sessionStatus } = useSession<any>();
  const typedSession: any = session;

  const [selectedProposalForModal, setSelectedProposalForModal] = useState<ProposalCardData | null>(null);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);

  const fetchProposals = useCallback(async (page: number, isBackgroundRefresh = false) => {
    if (!isBackgroundRefresh) {
      setIsLoading(true);
    } else {
      setIsPolling(true);
    }
    setError(null);
    try {
      const response = await fetch(`/api/proposals/active?page=${page}&limit=${proposalsPerPage}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to fetch proposals: ${response.statusText}`);
      }
      const data: ApiResponse = await response.json();
      setApiResponse(data);
    } catch (err: any) {
      setError(err.message);
      if (!isBackgroundRefresh) {
        toast.error(err.message || 'Could not load proposals.');
        setApiResponse(null);
      } else {
        console.warn("Background proposal refresh failed:", err.message);
      }
    }
    if (!isBackgroundRefresh) {
      setIsLoading(false);
    }
    setIsPolling(false);
  }, [proposalsPerPage]);

  useEffect(() => {
    fetchProposals(currentPage);
  }, [fetchProposals, currentPage]);

  // Polling mechanism
  useEffect(() => {
    if (PROPOSALS_REFRESH_INTERVAL > 0) {
      const intervalId = setInterval(() => {
        fetchProposals(currentPage, true);
      }, PROPOSALS_REFRESH_INTERVAL);
      return () => clearInterval(intervalId);
    }
  }, [fetchProposals, currentPage]);

  // Fetch current user's points
  useEffect(() => {
    if (sessionStatus === 'authenticated' && typedSession?.user?.walletAddress) {
      let pointsFound = false;
      const storedUserData = localStorage.getItem('defaiUserData');
      if (storedUserData) {
        try {
          const parsed = JSON.parse(storedUserData);
          if (typeof parsed.points === 'number') {
            setCurrentUserPoints(parsed.points);
            pointsFound = true;
          }
        } catch (e) {
          console.warn("Could not parse user data from LS for points on proposals page", e);
        }
      }

      if (!pointsFound) {
        fetch(`/api/users/points?address=${typedSession.user.walletAddress}`)
          .then(res => res.json())
          .then(data => {
            if (typeof data.points === 'number') {
              setCurrentUserPoints(data.points);
            }
          })
          .catch(err => {
            console.error("[ProposalsPage] Error fetching user points:", err);
            setCurrentUserPoints(null);
          });
      }
    } else if (sessionStatus === 'unauthenticated') {
      setCurrentUserPoints(null);
    }
  }, [sessionStatus, typedSession?.user?.walletAddress]);

  const handleOpenVoteModal = (proposalId: string) => {
    const proposalToVote = apiResponse?.proposals.find(p => p._id === proposalId);
    if (proposalToVote) {
      setSelectedProposalForModal(proposalToVote);
      setIsVoteModalOpen(true);
    } else {
      toast.error('Could not find proposal details to vote.');
    }
  };

  const handleCloseVoteModal = () => {
    setIsVoteModalOpen(false);
    setSelectedProposalForModal(null);
  };

  const handleVoteSuccess = () => {
    fetchProposals(currentPage, true);
  };

  const calculateTimeLeft = (epochEnd: number) => {
    const now = Date.now() / 1000;
    const timeLeft = epochEnd - now;
    
    if (timeLeft <= 0) return "Ended";
    
    const days = Math.floor(timeLeft / (24 * 60 * 60));
    const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60));
    
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  const getProposalStatus = (proposal: ProposalCardData) => {
    const now = Date.now() / 1000;
    if (now > proposal.epochEnd) return "ended";
    if (proposal.broadcasted) return "broadcasted";
    return "active";
  };

  const renderProposalCard = (proposal: ProposalCardData) => {
    const status = getProposalStatus(proposal);
    const netVotes = proposal.upVoteWeight - proposal.downVoteWeight;
    const totalVotes = proposal.upVoteWeight + proposal.downVoteWeight + proposal.abstainVoteWeight;
    const passPercentage = totalVotes > 0 ? (proposal.upVoteWeight / totalVotes) * 100 : 0;

    return (
      <Card key={proposal._id} className="overflow-hidden">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">
                <Link href={`/proposals/${proposal.slug}`} className="hover:text-[#3366FF] transition-colors">
                  {proposal.title}
                </Link>
              </CardTitle>
              <CardDescription className="flex items-center gap-2">
                <span>by {proposal.squadId.name}</span>
                <span>•</span>
                <span>{calculateTimeLeft(proposal.epochEnd)}</span>
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {status === "broadcasted" && (
                <Badge className="bg-green-500 text-white">Broadcasted</Badge>
              )}
              {status === "ended" && (
                <Badge variant="secondary">Ended</Badge>
              )}
              {status === "active" && (
                <Badge className="bg-[#3366FF] text-white">Active</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {proposal.description}
          </p>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Voting Progress</span>
              <span className="font-medium">{Math.round(passPercentage)}% Yes</span>
            </div>
            <Progress value={passPercentage} className="h-2" />
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">{formatPoints(proposal.upVoteWeight)}</p>
              <p className="text-xs text-muted-foreground">Yes</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{formatPoints(proposal.downVoteWeight)}</p>
              <p className="text-xs text-muted-foreground">No</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-500">{formatPoints(proposal.abstainVoteWeight)}</p>
              <p className="text-xs text-muted-foreground">Abstain</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {proposal.uniqueVoterCount} voters
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                {formatPoints(proposal.tokenReward)} reward
              </span>
            </div>
            {status === "active" && (
              <Button 
                size="sm" 
                className="bg-[#3366FF] hover:bg-[#2952cc]"
                onClick={() => handleOpenVoteModal(proposal._id)}
              >
                Vote Now
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Stats calculation
  const totalActiveProposals = apiResponse?.proposals.filter(p => getProposalStatus(p) === "active").length || 0;
  const totalVotes = apiResponse?.proposals.reduce((sum, p) => sum + p.uniqueVoterCount, 0) || 0;
  const totalRewards = apiResponse?.proposals.reduce((sum, p) => sum + p.tokenReward, 0) || 0;

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Platform</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Proposals</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto flex items-center gap-4 px-4">
          {currentUserPoints !== null && (
            <div className="text-sm">
              <span className="text-muted-foreground">Your voting power: </span>
              <span className="font-semibold">{formatPoints(currentUserPoints)}</span>
            </div>
          )}
          <Button className="hidden md:flex bg-[#3366FF] hover:bg-[#2952cc]">
            <Plus className="h-4 w-4 mr-2" />
            Create Proposal
          </Button>
        </div>
      </header>

      <main className="flex-1 py-6">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6">
            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Proposals</CardTitle>
                  <Vote className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalActiveProposals}</div>
                  <p className="text-xs text-muted-foreground">
                    Open for voting
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalVotes}</div>
                  <p className="text-xs text-muted-foreground">
                    Community participation
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Rewards</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatPoints(totalRewards)}</div>
                  <p className="text-xs text-muted-foreground">
                    DEFAI allocated
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Participation</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {apiResponse?.proposals.length ? 
                      Math.round(totalVotes / apiResponse.proposals.length) : 0
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Voters per proposal
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Proposals List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Community Proposals</CardTitle>
                    <CardDescription>
                      Vote on proposals to shape the future of DeFAI
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Sort: {selectedSort === "newest" ? "Newest" : "Ending Soon"}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelectedSort("newest")}>
                        Newest First
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSelectedSort("ending")}>
                        Ending Soon
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3366FF]"></div>
                    <p className="mt-4 text-muted-foreground">Loading proposals...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-12">
                    <p className="text-destructive mb-4">{error}</p>
                    <Button onClick={() => fetchProposals(currentPage)} variant="outline">
                      Try Again
                    </Button>
                  </div>
                ) : apiResponse?.proposals.length === 0 ? (
                  <div className="text-center py-12">
                    <Vote className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No active proposals at the moment</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {apiResponse?.proposals
                      .sort((a, b) => {
                        if (selectedSort === "ending") {
                          return a.epochEnd - b.epochEnd;
                        }
                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                      })
                      .map(renderProposalCard)
                    }
                  </div>
                )}

                {/* Pagination */}
                {apiResponse && apiResponse.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {apiResponse.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(apiResponse.totalPages, prev + 1))}
                      disabled={currentPage === apiResponse.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Vote Modal */}
      {selectedProposalForModal && (
        <VoteModal
          isOpen={isVoteModalOpen}
          onClose={handleCloseVoteModal}
          proposal={selectedProposalForModal}
          onVoteSuccess={handleVoteSuccess}
          currentUserPoints={currentUserPoints}
        />
      )}
    </SidebarInset>
  );
}