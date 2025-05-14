'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { ProposalCardData } from '@/components/proposals/ProposalCard'; // For type consistency
import { useSession } from 'next-auth/react'; // To check user points for voting eligibility message
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';

interface VoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: ProposalCardData | null; // Pass the full proposal data to the modal
  onVoteSuccess: () => void; // Simplified: just trigger a refresh/refetch on parent
  currentUserPoints: number | null;
}

const MIN_POINTS_TO_VOTE = parseInt(process.env.NEXT_PUBLIC_MIN_POINTS_TO_VOTE || "500", 10);

interface UserVoteData {
  choice: 'up' | 'down' | 'abstain';
  createdAt: string;
}

const VoteModal: React.FC<VoteModalProps> = ({ isOpen, onClose, proposal, onVoteSuccess, currentUserPoints }) => {
  const { data: session, status: sessionStatus } = useSession();
  const wallet = useWallet();
  const [isSubmittingVote, setIsSubmittingVote] = useState(false);
  const [currentUserVote, setCurrentUserVote] = useState<UserVoteData | null>(null);
  const [isFetchingUserVote, setIsFetchingUserVote] = useState(false);

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
          <p><strong>Current Weighted Score:</strong> {proposal.tally.totalEngagedWeight.toLocaleString()}</p>
          <p><strong>Votes:</strong> Up: {proposal.tally.upVotesCount}, Down: {proposal.tally.downVotesCount}, Abstain: {proposal.tally.abstainVotesCount} ({proposal.totalVoters} total)</p>
          {proposal.broadcasted && <p className="font-semibold text-green-600">This proposal has been broadcasted!</p>}
          {currentUserPoints != null && (
            <p><strong>Your voting weight:</strong> {currentUserPoints.toLocaleString()} pts</p>
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
                You need at least {MIN_POINTS_TO_VOTE.toLocaleString()} DeFAI points to vote. Your current points: {currentUserPoints.toLocaleString()}.
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
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">{hasVoted ? 'Close' : 'Cancel'}</Button>
          {isProposalActive && !hasVoted && !isLoading && (
            <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                    onClick={() => handleVoteSubmit('up')} 
                    disabled={isSubmittingVote || !canUserVoteCheck}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white disabled:opacity-70"
                >
                    {isSubmittingVote ? 'Voting...' : '👍 Upvote'}
                </Button>
                <Button 
                    onClick={() => handleVoteSubmit('down')} 
                    disabled={isSubmittingVote || !canUserVoteCheck}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white disabled:opacity-70"
                >
                    {isSubmittingVote ? 'Voting...' : '👎 Downvote'}
                </Button>
                <Button 
                    onClick={() => handleVoteSubmit('abstain')} 
                    disabled={isSubmittingVote || !canUserVoteCheck}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-70"
                >
                    {isSubmittingVote ? 'Voting...' : '👐 Abstain'}
                </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VoteModal; 