'use client';

import React from 'react';

// Interface for the vote tally, matches what /api/proposals/active provides
interface VoteTally {
  up: number;
  down: number;
  abstain: number;
  totalWeight: number;
}

// Interface for individual proposal data, matches what /api/proposals/active provides
export interface ProposalCardData {
  _id: string;
  squadId: string;
  squadName: string;
  // createdByUserId: string; // Not directly displayed on card typically
  tokenContractAddress: string;
  tokenName: string;
  reason: string;
  createdAt: string; 
  epochStart: string;
  epochEnd: string;
  broadcasted: boolean;
  // status: 'active' | 'archived'; // Status implicitly active if shown on this page
  tally: VoteTally;
  totalVoters: number;
}

interface ProposalCardProps {
  proposal: ProposalCardData;
  onVoteClick: (proposalId: string) => void; // Callback to open vote modal
}

const ProposalCard: React.FC<ProposalCardProps> = ({ proposal, onVoteClick }) => {
  const timeRemaining = () => {
    const now = new Date();
    const endDate = new Date(proposal.epochEnd);
    const diff = endDate.getTime() - now.getTime();

    if (diff <= 0) return "Voting ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  return (
    <div 
      className="bg-white border border-gray-200 rounded-xl shadow-lg p-5 sm:p-6 hover:shadow-xl transition-all duration-200 ease-in-out cursor-pointer transform hover:-translate-y-1 flex flex-col justify-between h-full"
      onClick={() => onVoteClick(proposal._id)}
    >
      <div>
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl lg:text-2xl font-bold text-blue-700 hover:text-blue-800 transition-colors">{proposal.tokenName}</h3>
          {proposal.broadcasted && (
            <span className="px-2.5 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full animate-pulse">
              🔥 BROADCASTED
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-1">Proposed by: <span className="font-medium text-indigo-600">{proposal.squadName}</span></p>
        <p className="text-sm text-gray-700 my-3 leading-relaxed line-clamp-3" title={proposal.reason}>&quot;{proposal.reason}&quot;</p>
        <p className="text-xs text-gray-500 mb-3 break-all">Contract: <code className="text-purple-600 bg-purple-50 px-1 py-0.5 rounded">{proposal.tokenContractAddress}</code></p>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <div>
            <p className="text-sm font-semibold text-gray-800">Weighted Score: {proposal.tally.totalWeight.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Up: {proposal.tally.up} | Down: {proposal.tally.down} | Abstain: {proposal.tally.abstain} ({proposal.totalVoters} voters)</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-blue-500">{timeRemaining()}</p>
          </div>
        </div>
        <button 
          className="w-full mt-3 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
          onClick={(e) => { 
            e.stopPropagation(); // Prevent card click if button is distinct
            onVoteClick(proposal._id); 
          }}
        >
          View & Vote
        </button>
      </div>
    </div>
  );
};

export default ProposalCard; 