'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import ProposalCard, { ProposalCardData } from '@/components/proposals/ProposalCard';
import VoteModal from '@/components/modals/VoteModal';
import { useSession } from 'next-auth/react';

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
  const typedSession:any = session;

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

  // Fetch current user points (similar logic to proposals list page)
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
    fetchProposal(); // refresh proposal tallies after successful vote
  };

  const openVoteModal = () => setIsVoteModalOpen(true);
  const closeVoteModal = () => setIsVoteModalOpen(false);

  if (isLoading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-6">
        <p className="text-lg text-foreground">Loading proposal…</p>
      </main>
    );
  }

  if (error || !proposal) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-4">
        <p className="text-xl font-semibold text-red-600">{error || 'Proposal not found.'}</p>
        <Link href="/proposals" className="text-blue-600 underline">← Back to Proposals</Link>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-background text-foreground">
      <div className="w-full max-w-3xl mx-auto space-y-6">
        <Link href="/proposals" className="text-sm text-blue-600 hover:underline">← Back to Proposals</Link>

        <ProposalCard proposal={proposal} onVoteClick={openVoteModal} currentUserPoints={currentUserPoints} />
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
    </main>
  );
} 