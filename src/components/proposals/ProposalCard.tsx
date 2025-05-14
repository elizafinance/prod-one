'use client';

import React from 'react';

// Updated interface for the vote tally to match new API structure
interface DetailedVoteTally {
  upVotesCount: number;
  downVotesCount: number;
  abstainVotesCount: number;
  upVotesWeight: number;
  downVotesWeight: number;
  netVoteWeight: number;
  totalEngagedWeight: number;
}

// Updated interface for individual proposal data
export interface ProposalCardData {
  _id: string;
  squadId: string;
  squadName: string;
  tokenContractAddress: string;
  tokenName: string;
  reason: string;
  createdAt: string; 
  epochStart: string;
  epochEnd: Date; // Use Date type if it's already transformed, or string if raw from API
  broadcasted: boolean;
  status: 'active' | 'closed_passed' | 'closed_failed' | 'closed_executed' | 'archived'; // Include all statuses
  tally: DetailedVoteTally;
  totalVoters: number;
  // Add these if they are part of the lean proposal object from the API
  // and needed directly on the card, otherwise tally covers most vote aspects.
  // finalUpVotesWeight?: number;
  // finalDownVotesWeight?: number;
  // finalAbstainVotesCount?: number;
  // totalFinalVoters?: number;
  // finalUpVotesCount?: number;
  // finalDownVotesCount?: number;
}

interface ProposalCardProps {
  proposal: ProposalCardData;
  onVoteClick: (proposalId: string) => void;
  currentUserPoints?: number | null; // Optional points to display user weight
}

// Environment variable targets for progress bars (with defaults)
const QUORUM_VOTERS_TARGET = parseInt(process.env.NEXT_PUBLIC_PROPOSAL_QUORUM_VOTERS_TARGET || "10", 10);
const QUORUM_WEIGHT_TARGET = parseInt(process.env.NEXT_PUBLIC_PROPOSAL_QUORUM_WEIGHT_TARGET || "5000", 10);
const PASS_NET_WEIGHT_TARGET = parseInt(process.env.NEXT_PUBLIC_PROPOSAL_PASS_NET_WEIGHT_TARGET || "1000", 10);

const ProgressBar: React.FC<{ value: number; maxValue: number; colorClass: string, label: string }> = ({ value, maxValue, colorClass, label }) => {
  const percentage = maxValue > 0 ? Math.min((value / maxValue) * 100, 100) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-600 mb-0.5">
        <span>{label}</span>
        <span>{value.toLocaleString()} / {maxValue.toLocaleString()} ({percentage.toFixed(0)}%)</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div 
          className={`h-2.5 rounded-full ${colorClass} transition-all duration-500 ease-out`} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, onVoteClick, currentUserPoints }) => {
  const timeRemaining = () => {
    const now = new Date();
    // Ensure proposal.epochEnd is a Date object
    const endDate = typeof proposal.epochEnd === 'string' ? new Date(proposal.epochEnd) : proposal.epochEnd;
    const diff = endDate.getTime() - now.getTime();

    if (diff <= 0) {
      if (proposal.status === 'active') return "Ending soon"; // Should be closed by cron
      return "Voting ended";
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };
  
  const { tally, totalVoters, status } = proposal;

  const isClosed = status !== 'active';

  return (
    <div 
      className="bg-white border border-gray-200 rounded-xl shadow-lg p-5 sm:p-6 hover:shadow-xl transition-all duration-200 ease-in-out flex flex-col justify-between h-full"
      // onClick={() => onVoteClick(proposal._id)} // Make clicking anywhere open modal
    >
      <div onClick={() => onVoteClick(proposal._id)} className="cursor-pointer">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl lg:text-2xl font-bold text-blue-700 hover:text-blue-800 transition-colors line-clamp-2" title={proposal.tokenName}>{proposal.tokenName}</h3>
          {proposal.broadcasted && (
            <span className="px-2.5 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">
              📢 BROADCASTED
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-1">Proposed by: <span className="font-medium text-indigo-600">{proposal.squadName}</span></p>
        <p className="text-sm text-gray-700 my-3 leading-relaxed line-clamp-3" title={proposal.reason}>&quot;{proposal.reason}&quot;</p>
        <p className="text-xs text-gray-500 mb-3 break-all">Contract: <code className="text-purple-600 bg-purple-50 px-1 py-0.5 rounded">{proposal.tokenContractAddress}</code></p>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        {currentUserPoints != null && (
          <div className="mb-2 text-xs text-gray-600">
            Your voting weight: <span className="font-semibold text-indigo-700">{currentUserPoints.toLocaleString()}</span> pts
          </div>
        )}

        {status === 'active' && (
          <>
            {QUORUM_VOTERS_TARGET > 0 && 
              <ProgressBar value={totalVoters} maxValue={QUORUM_VOTERS_TARGET} colorClass="bg-yellow-500" label="Quorum (Voters)"/>
            }
            {QUORUM_WEIGHT_TARGET > 0 && 
              <ProgressBar value={tally.totalEngagedWeight} maxValue={QUORUM_WEIGHT_TARGET} colorClass="bg-orange-500" label="Quorum (Weight)"/>
            }
            {PASS_NET_WEIGHT_TARGET > 0 && 
              <ProgressBar value={Math.max(0, tally.netVoteWeight)} maxValue={PASS_NET_WEIGHT_TARGET} colorClass="bg-green-500" label="Approval Strength"/>
            }
          </>
        )}

        <div className="flex justify-between items-center my-3">
          <div className="text-xs text-gray-500">
            <p>Up: {tally.upVotesCount} ({tally.upVotesWeight.toLocaleString()} pts)</p>
            <p>Down: {tally.downVotesCount} ({tally.downVotesWeight.toLocaleString()} pts)</p>
            <p>Abstain: {tally.abstainVotesCount} ({totalVoters} voters)</p>
          </div>
          <div className="text-right">
            <p className={`text-sm font-semibold ${tally.netVoteWeight > 0 ? 'text-green-600' : tally.netVoteWeight < 0 ? 'text-red-600' : 'text-gray-700'}`}>
              Net: {tally.netVoteWeight.toLocaleString()} pts
            </p>
            <p className="text-xs font-medium text-blue-500 mt-1">{timeRemaining()}</p>
          </div>
        </div>
        
        {isClosed && (
          <div className={`mt-3 p-2 text-center rounded-md text-sm font-semibold 
            ${status === 'closed_passed' || status === 'closed_executed' ? 'bg-green-100 text-green-700' : 
              status === 'closed_failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}
          `}>
            Status: {status.replace('closed_', '').toUpperCase()}
          </div>
        )}

        <button 
          className={`w-full mt-3 py-2.5 px-4 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-opacity-50 
            ${isClosed ? 'bg-gray-500 hover:bg-gray-600 focus:ring-gray-400' : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'}
          `}
          onClick={(e) => { 
            e.stopPropagation(); 
            onVoteClick(proposal._id); 
          }}
        >
          {isClosed ? 'View Details' : 'View & Vote'}
        </button>
      </div>
    </div>
  );
};

export default ProposalCard; 