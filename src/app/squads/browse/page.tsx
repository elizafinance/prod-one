"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { SquadDocument, ISquadJoinRequest } from '@/lib/mongodb'; // Added ISquadJoinRequest
import RequestToJoinModal from '@/components/modals/RequestToJoinModal'; // Import the new modal
import { TOKEN_LABEL_POINTS } from '@/lib/labels';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { 
  Breadcrumb, 
  BreadcrumbList, 
  BreadcrumbItem, 
  BreadcrumbLink, 
  BreadcrumbSeparator, 
  BreadcrumbPage 
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Shield, Search, Users, Trophy, XCircle, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface SquadBrowseEntry extends SquadDocument {
  memberCount: number; // Added from leaderboard API projection
  totalSquadPoints: number; // Added from leaderboard API projection
}

interface MySquadInfo {
  squadId?: string | null;
}

// Define a simple structure for the request object we might fetch
interface UserJoinRequestSummary {
  squadId: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default function BrowseSquadsPage() {
  const [squads, setSquads] = useState<SquadBrowseEntry[]>([]);
  const [mySquadInfo, setMySquadInfo] = useState<MySquadInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // const [isJoining, setIsJoining] = useState<string | null>(null); // Old state for direct join
  const [error, setError] = useState<string | null>(null);
  const { publicKey, connected } = useWallet();
  const router = useRouter();
  const currentUserWalletAddress = publicKey?.toBase58();

  // New state for request to join modal
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedSquadForRequest, setSelectedSquadForRequest] = useState<SquadBrowseEntry | null>(null);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // New state for user's pending join requests
  const [currentUserPendingRequests, setCurrentUserPendingRequests] = useState<UserJoinRequestSummary[]>([]);

  const fetchSquadsAndUserData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const leaderboardResponse = await fetch('/api/squads/leaderboard');
      if (!leaderboardResponse.ok) {
        throw new Error('Failed to fetch squads list');
      }
      const leaderboardData = await leaderboardResponse.json();
      setSquads(leaderboardData as SquadBrowseEntry[]);

      if (connected && publicKey) {
        const userWalletAddress = publicKey.toBase58();
        // Fetch current user's squad status
        const mySquadResponse = await fetch(`/api/squads/my-squad?userWalletAddress=${encodeURIComponent(userWalletAddress)}`);
        if (mySquadResponse.ok) {
          const mySquadData = await mySquadResponse.json();
          setMySquadInfo({ squadId: mySquadData.squad?.squadId });
        } else {
          setMySquadInfo(null);
        }

        // Fetch user's pending join requests
        const pendingRequestsResponse = await fetch('/api/squads/join-requests/my-pending');
        if (pendingRequestsResponse.ok) {
          const pendingData = await pendingRequestsResponse.json();
          setCurrentUserPendingRequests(pendingData.requests || []);
        } else {
          console.error("Failed to fetch user's pending requests:", await pendingRequestsResponse.text());
          setCurrentUserPendingRequests([]);
        }
      } else {
        setMySquadInfo(null);
        setCurrentUserPendingRequests([]);
      }
    } catch (err) {
      setError((err as Error).message || 'Could not load squads data.');
      console.error(err);
    }
    setIsLoading(false);
  }, [connected, publicKey]);

  useEffect(() => {
    fetchSquadsAndUserData();
  }, [fetchSquadsAndUserData]);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('points');

  const handleOpenRequestModal = (squad: SquadBrowseEntry) => {
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet to request to join a squad.");
      return;
    }
    if (mySquadInfo?.squadId) {
      toast.info("You are already in a squad. Leave your current squad to request to join another.");
      return;
    }
    setSelectedSquadForRequest(squad);
    setIsRequestModalOpen(true);
  };

  const handleSubmitJoinRequest = async (squadIdToRequest: string, message?: string) => {
    if (!publicKey) return;
    setIsSubmittingRequest(true);
    try {
      const response = await fetch(`/api/squads/${squadIdToRequest}/request-join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || "Request sent successfully!");
        setIsRequestModalOpen(false);
        // Add to local pending requests state (optimistic or refetch)
        setCurrentUserPendingRequests(prev => [...prev, { squadId: squadIdToRequest, status: 'pending' }]);
        // fetchSquadsAndUserData(); // Or just refetch user specific data
      } else {
        toast.error(data.error || "Failed to send request.");
      }
    } catch (err) {
      toast.error("An unexpected error occurred while sending request.");
      console.error("Request join error:", err);
    }
    setIsSubmittingRequest(false);
  };

  const filteredSquads = squads.filter(squad => {
    if (!searchQuery) return true;
    return squad.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           squad.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const sortedSquads = [...filteredSquads].sort((a, b) => {
    if (sortBy === 'points') {
      return b.totalSquadPoints - a.totalSquadPoints;
    } else if (sortBy === 'members') {
      return b.memberCount - a.memberCount;
    } else if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
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
                <BreadcrumbPage>Browse</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Browse Squads</h1>
          <div className="flex gap-2">
            <Link href="/squads/create">
              <Button variant="outline">
                Create Squad
              </Button>
            </Link>
            <Link href="/squads/my">
              <Button variant="outline">
                <Shield className="h-4 w-4 mr-2" />
                My Squad
              </Button>
            </Link>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search squads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="points">Most Points</SelectItem>
              <SelectItem value="members">Most Members</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {connected && mySquadInfo?.squadId && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <p className="text-sm text-center">
                You are already in a squad. You must leave your current squad to join another.
                <Link href="/squads/my" className="ml-2 text-primary hover:underline">
                  View my squad
                </Link>
              </p>
            </CardContent>
          </Card>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Searching for squads...</p>
            </div>
          </div>
        )}
        
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive text-center">Error: {error}</p>
            </CardContent>
          </Card>
        )}
        
        {!isLoading && !error && sortedSquads.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-10">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-semibold mb-2">No Squads Found</p>
                <p className="text-sm text-muted-foreground mb-4">Try adjusting your search or be the first to create a squad!</p>
                <Link href="/squads/create">
                  <Button>
                    Create Squad
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && sortedSquads.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedSquads.map((squad) => {
              const hasPendingRequestForThisSquad = currentUserPendingRequests.some(req => req.squadId === squad.squadId && req.status === 'pending');
              const isSquadFull = squad.memberCount >= (squad.maxMembers || parseInt(process.env.NEXT_PUBLIC_MAX_SQUAD_MEMBERS || '50'));
              const isUserLeaderHere = squad.leaderWalletAddress === publicKey?.toBase58();

              return (
                <Card key={squad.squadId} className="overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src="/placeholder.svg" />
                          <AvatarFallback>{squad.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{squad.name}</CardTitle>
                          {squad.description && (
                            <CardDescription className="mt-1 line-clamp-2">
                              {squad.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Members</p>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <p className="text-lg font-semibold">{squad.memberCount} / {squad.maxMembers || 50}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Points</p>
                        <div className="flex items-center gap-1">
                          <Trophy className="h-4 w-4 text-muted-foreground" />
                          <p className="text-lg font-semibold">{squad.totalSquadPoints.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                      <span>Leader</span>
                      <span className="font-mono font-medium">
                        {squad.leaderWalletAddress.substring(0,6)}...{squad.leaderWalletAddress.substring(squad.leaderWalletAddress.length-4)}
                      </span>
                    </div>
                    {(!connected || !publicKey) && (
                      <p className="text-xs text-center text-muted-foreground py-2">
                        Connect wallet to interact
                      </p>
                    )}
                    {isUserLeaderHere && (
                      <Badge className="w-full justify-center" variant="default">
                        <Shield className="h-3 w-3 mr-1" />
                        You are Leader
                      </Badge>
                    )}
                    {mySquadInfo?.squadId && !isUserLeaderHere && (
                      <Badge className="w-full justify-center" variant="secondary">
                        <Shield className="h-3 w-3 mr-1" />
                        Already in Squad
                      </Badge>
                    )}
                    {isSquadFull && !mySquadInfo?.squadId && (
                      <Badge className="w-full justify-center" variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Squad Full
                      </Badge>
                    )}
                    {hasPendingRequestForThisSquad && (
                      <Badge className="w-full justify-center" variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        Request Pending
                      </Badge>
                    )}
                  </CardContent>
                  <CardFooter className="pt-0">
                    <div className="flex gap-2 w-full">
                      <Link href={`/squads/${squad.squadId}`} className="flex-1">
                        <Button variant="outline" className="w-full" size="sm">
                          View Details
                        </Button>
                      </Link>
                      {connected && publicKey && !mySquadInfo?.squadId && !isSquadFull && !hasPendingRequestForThisSquad && !isUserLeaderHere && (
                        <Button 
                          onClick={() => handleOpenRequestModal(squad)}
                          className="flex-1"
                          size="sm"
                        >
                          Request to Join
                        </Button>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      
      {selectedSquadForRequest && (
        <RequestToJoinModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          squadName={selectedSquadForRequest.name}
          squadId={selectedSquadForRequest.squadId}
          onSubmit={handleSubmitJoinRequest}
          isSubmitting={isSubmittingRequest}
        />
      )}
    </SidebarInset>
  );
} 