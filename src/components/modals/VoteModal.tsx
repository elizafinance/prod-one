'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { ProposalCardData } from '@/components/proposals/ProposalCard'; // For type consistency
import { useSession } from 'next-auth/react'; // To check user points for voting eligibility message

interface VoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: ProposalCardData | null; // Pass the full proposal data to the modal
  onVoteSuccess: (updatedProposal: ProposalCardData) => void; // Callback to update UI after vote
}

const MIN_POINTS_TO_VOTE = parseInt(process.env.NEXT_PUBLIC_MIN_POINTS_TO_VOTE || "500", 10);

const VoteModal: React.FC<VoteModalProps> = ({ isOpen, onClose, proposal, onVoteSuccess }) => {
  const { data: session } = useSession();
  const [isVoting, setIsVoting] = useState(false);
  const [userPoints, setUserPoints] = useState<number | null>(null);

  // Fetch user points - This is for display/UX only, actual check is on backend
  useEffect(() => {
    if (session?.user?.walletAddress) {
      // In a real app, you might fetch this from an API or have it in session/context
      // For now, let's try to get it from where the main page might have stored it
      const storedUserData = localStorage.getItem('defaiUserData'); 
      if (storedUserData) {
        try {
            const parsed = JSON.parse(storedUserData);
            if (typeof parsed.points === 'number') {
                setUserPoints(parsed.points);
            }
        } catch (e) { console.error("Error parsing user data from LS for points check", e); }
      }
    }
  }, [session]);

  const handleVote = async (choice: 'up' | 'down' | 'abstain') => {
    if (!proposal) return;
    setIsVoting(true);
    try {
      const response = await fetch(`/api/proposals/${proposal._id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to cast vote.');
      }
      toast.success(`Vote (${choice}) cast successfully!`);
      
      // Optimistically update proposal tally or re-fetch data
      // For now, just update based on the vote choice and assume backend calculated points correctly.
      // A more robust solution would be for the API to return the updated proposal/tally.
      const updatedTally = { ...proposal.tally };
      if (choice === 'up') updatedTally.up += 1;
      else if (choice === 'down') updatedTally.down += 1;
      else if (choice === 'abstain') updatedTally.abstain += 1;
      // Note: totalWeight update is complex without knowing voter's points here.
      // The onVoteSuccess callback should trigger a re-fetch or use API-returned data.

      onVoteSuccess({ 
          ...proposal, 
          tally: updatedTally, 
          totalVoters: proposal.totalVoters + 1 
      }); 
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while voting.');
    }
    setIsVoting(false);
  };

  if (!proposal) return null;

  const canUserVote = userPoints !== null && userPoints >= MIN_POINTS_TO_VOTE;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
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
          <p><strong>Current Weighted Score:</strong> {proposal.tally.totalWeight.toLocaleString()}</p>
          <p><strong>Votes:</strong> Up: {proposal.tally.up}, Down: {proposal.tally.down}, Abstain: {proposal.tally.abstain} ({proposal.totalVoters} total)</p>
          {proposal.broadcasted && <p className="font-semibold text-green-600">This proposal has been broadcasted!</p>}
        </div>

        {!canUserVote && userPoints !== null && (
            <div className="my-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-700 text-sm">
                You need at least {MIN_POINTS_TO_VOTE} DeFAI points to vote. Your current points: {userPoints.toLocaleString()}.
            </div>
        )}
        {userPoints === null && (
             <div className="my-3 p-3 bg-gray-100 border border-gray-200 rounded-md text-gray-600 text-sm">
                Verifying your points balance for voting...
            </div>
        )}

        <DialogFooter className="mt-4 sm:justify-between gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
                onClick={() => handleVote('up')} 
                disabled={isVoting || !canUserVote}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white disabled:opacity-70"
            >
                {isVoting ? 'Voting...' : '👍 Upvote'}
            </Button>
            <Button 
                onClick={() => handleVote('down')} 
                disabled={isVoting || !canUserVote}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white disabled:opacity-70"
            >
                {isVoting ? 'Voting...' : '👎 Downvote'}
            </Button>
            <Button 
                onClick={() => handleVote('abstain')} 
                disabled={isVoting || !canUserVote}
                className="flex-1 bg-gray-500 hover:bg-gray-600 text-white disabled:opacity-70"
            >
                {isVoting ? 'Voting...' : '👐 Abstain'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VoteModal; 