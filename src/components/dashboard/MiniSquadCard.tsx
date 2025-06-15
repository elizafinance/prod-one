"use client";

import Link from 'next/link';
import { TOKEN_LABEL_POINTS } from '@/lib/labels';
import { ShieldCheckIcon, UsersIcon, ArrowRightIcon } from '@heroicons/react/24/outline'; // Example icons

interface MiniSquadCardProps {
  squadId?: string | null;
  squadName?: string | null;
  totalSquadPoints?: number | null;
  memberCount?: number | null;
  maxMembers?: number | null;
  isLeader?: boolean;
  isLoading: boolean;
}

const MiniSquadCard: React.FC<MiniSquadCardProps> = ({
  squadId,
  squadName,
  totalSquadPoints,
  memberCount,
  maxMembers,
  isLeader,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="p-4 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50 animate-pulse">
        <div className="h-6 bg-gray-200/50 rounded w-3/4 mb-3"></div>
        <div className="h-4 bg-gray-200/50 rounded w-1/2 mb-2"></div>
        <div className="h-4 bg-gray-200/50 rounded w-1/3"></div>
      </div>
    );
  }

  if (!squadId || !squadName) {
    return (
      <div className="p-6 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50 text-center">
        <UsersIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-md font-semibold text-foreground mb-1">No Squad Yet</h3>
        <p className="text-xs text-muted-foreground mb-3">Join or create a squad to boost your earnings!</p>
        
        <Link href="/squads/browse" passHref>
          <button className="w-full py-2 px-4 bg-[#2B96F1] hover:bg-blue-600 text-white text-xs font-semibold rounded-lg shadow hover:shadow-md transition-colors">
            Browse Squads
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5 bg-white/60 backdrop-blur-md shadow-lg rounded-xl border border-gray-200/50 hover:shadow-xl transition-shadow duration-300">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 truncate" title={squadName}>
          {squadName}
        </h3>
        {isLeader && (
          <span className="text-xs font-semibold px-2 py-0.5 bg-yellow-400 text-yellow-800 rounded-full shadow-sm">Leader</span>
        )}
      </div>
      
      <div className="space-y-1.5 text-sm mb-3">
        <div className="flex items-center text-foreground/80">
          <ShieldCheckIcon className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
          <span>{TOKEN_LABEL_POINTS}: <strong className="text-green-600 font-semibold">{totalSquadPoints?.toLocaleString() ?? 'N/A'}</strong></span>
        </div>
        <div className="flex items-center text-foreground/80">
          <UsersIcon className="w-4 h-4 mr-2 text-blue-500 flex-shrink-0" />
          <span>Members: <strong className="text-blue-600 font-semibold">{memberCount ?? 'N/A'} / {maxMembers ?? 'N/A'}</strong></span>
        </div>
      </div>

      <Link href={`/squads/my`} passHref> {/* Changed from /squads/${squadId} to /squads/my as per plan */}
        <button className="w-full mt-2 py-2 px-4 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow hover:shadow-md transition-colors flex items-center justify-center gap-1.5">
          Go to My Squad <ArrowRightIcon className="w-3 h-3"/>
        </button>
      </Link>
    </div>
  );
};

export default MiniSquadCard; 