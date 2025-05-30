'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { ProposalCardData } from '@/components/proposals/ProposalCard'; // For type consistency
import { useSession } from 'next-auth/react'; // To check user points for voting eligibility message
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { useRouter } from 'next/navigation';
import { TOKEN_LABEL_POINTS } from '@/lib/labels';

interface VoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: ProposalCardData | null; // Pass the full proposal data to the modal
  onVoteSuccess: () => void; // Simplified: just trigger a refresh/refetch on parent
  currentUserPoints: number | null;
}

const MIN_POINTS_TO_VOTE = 100; // Example: User needs 100 DeFAI Points to vote

interface UserVoteData {
  choice: 'up' | 'down' | 'abstain';
  createdAt: string;
}

const VoteModal: React.FC<VoteModalProps> = ({ isOpen, onClose, proposal, onVoteSuccess, currentUserPoints }) => {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession<any>();
  const wallet = useWallet();
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [currentUserVote, setCurrentUserVote] = useState<UserVoteData | null>(null);
  const [isFetchingUserVote, setIsFetchingUserVote] = useState(false);
  const [isSquadLeader, setIsSquadLeader] = useState<boolean>(false);
  const [voteCount, setVoteCount] = useState<number | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const typedSession: any = session;

  const isProposalActive = proposal?.status === 'active';

  // Fetch user's current vote for this proposal when modal opens or proposal changes
  useEffect(() => {
    if (isOpen && proposal && sessionStatus === 'authenticated') {
      setIsFetchingUserVote(true);
      setCurrentUserVote(null); // Reset previous vote state
      fetch(`/api/proposals/${proposal._id}/my-vote`)
        .then(res => {
          if (!res.ok) {
            // If 404 or similar, it might just mean no vote, not necessarily an error to show user
            if (res.status === 404) return { vote: null }; 
            throw new Error('Failed to fetch your vote status');
          }
          return res.json();
        })
        .then(data => {
          if (data.vote) {
            setCurrentUserVote(data.vote as UserVoteData);
          }
        })
        .catch(err => {
          console.error("Error fetching user's vote:", err);
          // Don't toast an error here usually, as it might just be no vote found
        })
        .finally(() => {
          setIsFetchingUserVote(false);
        });
    } else if (!isOpen) {
      // Reset when modal closes
      setCurrentUserVote(null);
      setIsFetchingUserVote(false);
    }
  }, [isOpen, proposal, sessionStatus, proposal?._id]);

  // Check if the user is the squad leader and if the proposal has votes
  useEffect(() => {
    if (isOpen && proposal && typedSession?.user?.walletAddress) {
      // Check if user is squad leader
      const userIsLeader = typedSession.user.walletAddress === proposal.leaderWalletAddress; // Add this field to your ProposalCardData interface if needed
      setIsSquadLeader(userIsLeader);
      
      // If leader, also check vote count to determine if can cancel
      if (userIsLeader) {
        // Use voters count (for active proposals) or final voters for closed ones
        setVoteCount(proposal.totalVoters ?? proposal.totalFinalVoters ?? null);
      }
    }
  }, [isOpen, proposal, typedSession?.user?.walletAddress]);

  const handleVoteSubmit = async (choice: 'up' | 'down' | 'abstain') => {
    console.time('[VoteModal] vote');
    if (!isProposalActive) {
      toast.error('Voting period has ended for this proposal.');
      return;
    }
    if (!proposal) return;
    setIsSubmittingVote(true);
    if (!wallet.connected || !wallet.publicKey) {
      toast.error('Please connect your wallet before voting.');
      setIsSubmittingVote(false);
      console.timeEnd('[VoteModal] vote');
      return;
    }

    if (!wallet.signMessage) {
      toast.error('Your wallet does not support message signing.');
      setIsSubmittingVote(false);
      console.timeEnd('[VoteModal] vote');
      return;
    }

    // Compose the message to be signed (domain-separated)
    const message = `defai-vote|${proposal._id}|${choice}|${Date.now()}`;

    let signatureB58 = '';
    try {
      const encodedMsg = new TextEncoder().encode(message);
      const signature = await wallet.signMessage(encodedMsg);
      signatureB58 = bs58.encode(signature);
    } catch (signErr: any) {
      console.error('[VoteModal] User aborted message signing', signErr);
      toast.error('Message signing was cancelled.');
      setIsSubmittingVote(false);
      console.timeEnd('[VoteModal] vote');
      return;
    }

    try {
      const response = await fetch(`/api/proposals/${proposal._id}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-sig': signatureB58,
          'x-wallet-msg': message,
        },
        body: JSON.stringify({ choice }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.message || 'Failed to cast vote.');
      }
      toast.success(`Vote (${choice}) cast successfully!`);
      setCurrentUserVote({ choice, createdAt: new Date().toISOString() }); // Optimistically update UI
      onVoteSuccess(); // Trigger parent to refetch proposal data or list
    } catch (err: any) {
      console.error('[VoteModal] Vote submit error:', err);
      toast.error(err.message || 'An error occurred while voting.');
    }
    console.timeEnd('[VoteModal] vote');
    setIsSubmittingVote(false);
  };

  // Function to cancel proposal
  const handleCancelProposal = async () => {
    if (!proposal) return;
    setIsCancelling(true);
    
    try {
      const response = await fetch(`/api/proposals/${proposal._id}/cancel`, {
        method: 'POST',
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel proposal');
      }
      
      toast.success('Proposal successfully cancelled');
      onVoteSuccess(); // Refresh data
      onClose(); // Close modal
      
      // Optionally redirect back to proposals page
      router.push('/proposals');
    } catch (err: any) {
      console.error('[VoteModal] Error cancelling proposal:', err);
      toast.error(err.message || 'Failed to cancel proposal');
    } finally {
      setIsCancelling(false);
    }
  };

  if (!proposal) return null;

  const canUserVoteCheck = currentUserPoints !== null && currentUserPoints >= MIN_POINTS_TO_VOTE;
  const hasVoted = !!currentUserVote;
  const isLoading = isFetchingUserVote || sessionStatus === 'loading';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[525px] bg-white border-gray-300 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-spacegrotesk text-blue-700">
            Vote: {proposal.tokenName}
          </DialogTitle>
          <DialogDescription className="text-gray-600 pt-2">
            Proposed by: <span className="font-semibold text-indigo-600">{proposal.squadName}</span>
            <br />
            Reason: <span className="italic">{proposal.reason}</span>
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3 text-sm text-gray-700">
          <p><strong>Contract:</strong> <code className="text-xs bg-gray-100 p-1 rounded">{proposal.tokenContractAddress}</code></p>
          <p><strong>Current Weighted Score:</strong> {proposal.tally?.totalEngagedWeight?.toLocaleString() ?? '—'}</p>
          <p><strong>Votes:</strong> Up: {proposal.tally?.upVotesCount ?? '—'}, Down: {proposal.tally?.downVotesCount ?? '—'}, Abstain: {proposal.tally?.abstainVotesCount ?? '—'} ({proposal.totalVoters ?? proposal.totalFinalVoters ?? '—'} total)</p>
          {proposal.broadcasted && <p className="font-semibold text-green-600">This proposal has been broadcasted!</p>}
          {currentUserPoints != null && (
            <p><strong>Your voting weight:</strong> {currentUserPoints.toLocaleString()} {TOKEN_LABEL_POINTS}</p>
          )}
        </div>

        {isLoading && (
            <div className="my-3 p-3 bg-gray-100 border border-gray-200 rounded-md text-gray-600 text-sm text-center">
                Loading your voting status...
            </div>
        )}

        {!isLoading && hasVoted && currentUserVote && (
            <div className="my-3 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-center">
                <p className="font-semibold">You voted: <span className="uppercase">{currentUserVote.choice}</span></p>
                <p className="text-xs mt-1">on {new Date(currentUserVote.createdAt).toLocaleDateString()}</p>
            </div>
        )}

        {!isLoading && !hasVoted && !canUserVoteCheck && currentUserPoints !== null && (
            <div className="my-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-700 text-sm">
                You need at least {MIN_POINTS_TO_VOTE.toLocaleString()} {TOKEN_LABEL_POINTS} to vote. Your current {TOKEN_LABEL_POINTS}: {currentUserPoints.toLocaleString()}.
            </div>
        )}
        {/* Show if not loading, user hasn't voted, and points couldn't be determined */}
        {!isLoading && !hasVoted && currentUserPoints === null && (
             <div className="my-3 p-3 bg-gray-100 border border-gray-200 rounded-md text-gray-600 text-sm">
                Could not verify your points balance for voting. Please ensure your profile is up to date.
            </div>
        )}

        {!isLoading && !isProposalActive && (
            <div className="my-3 p-3 bg-gray-100 border border-gray-200 rounded-md text-gray-700 text-sm text-center">
                Voting has ended for this proposal.
            </div>
        )}

        <DialogFooter className="mt-4 sm:justify-between gap-2 flex-col sm:flex-row">
          <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">{hasVoted ? 'Close' : 'Cancel'}</Button>
            
            {/* Squad Leader Cancel Button */}
            {isProposalActive && isSquadLeader && voteCount === 0 && (
              <Button
                variant="destructive"
                onClick={handleCancelProposal}
                disabled={isCancelling}
                className="w-full sm:w-auto"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Proposal'}
              </Button>
            )}
          </div>
          {isProposalActive && !hasVoted && !isLoading && (
            <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                    onClick={() => handleVoteSubmit('up')} 
                    disabled={isSubmittingVote || (currentUserPoints !== null && currentUserPoints < MIN_POINTS_TO_VOTE)}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white disabled:opacity-70"
                >
                    {isSubmittingVote ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Submitting Vote...
                        </>
                    ) : '👍 Upvote'}
                </Button>
                <Button 
                    onClick={() => handleVoteSubmit('down')} 
                    disabled={isSubmittingVote || (currentUserPoints !== null && currentUserPoints < MIN_POINTS_TO_VOTE)}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white disabled:opacity-70"
                >
                    {isSubmittingVote ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Submitting Vote...
                        </>
                    ) : '👎 Downvote'}
                </Button>
                <Button 
                    onClick={() => handleVoteSubmit('abstain')} 
                    disabled={isSubmittingVote || (currentUserPoints !== null && currentUserPoints < MIN_POINTS_TO_VOTE)}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-70"
                >
                    {isSubmittingVote ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Submitting Vote...
                        </>
                    ) : '👐 Abstain'}
                </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VoteModal; 