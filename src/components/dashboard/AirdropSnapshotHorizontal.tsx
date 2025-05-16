"use client";

import { TOKEN_LABEL_AIR, TOKEN_LABEL_POINTS } from '@/lib/labels';
import { SparklesIcon, CurrencyDollarIcon, GiftIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

interface AirdropSnapshotHorizontalProps {
  initialAirdropAllocation: number | null;
  defaiBalance: number | null;
  userPoints: number | null;
  totalCommunityPoints: number | null;
  airdropPoolSize: number;
  snapshotDateString: string;
  isLoading: boolean;
}

const AirdropSnapshotHorizontal: React.FC<AirdropSnapshotHorizontalProps> = ({
  initialAirdropAllocation,
  defaiBalance,
  userPoints,
  totalCommunityPoints,
  airdropPoolSize,
  snapshotDateString,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 p-4 md:p-6 bg-white/60 backdrop-blur-md shadow-xl rounded-xl border border-gray-200/50 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-200/50 rounded-lg"></div>
        ))}
      </div>
    );
  }

  const pointsShare = 
    userPoints !== null && userPoints > 0 && totalCommunityPoints !== null && totalCommunityPoints > 0 
    ? (userPoints / totalCommunityPoints) * airdropPoolSize 
    : 0;
  
  const totalEstimatedAirdrop = (initialAirdropAllocation || 0) + (defaiBalance !== null ? defaiBalance : 0) + pointsShare;

  const statItemClasses = "flex flex-col items-center justify-center p-4 bg-white/20 backdrop-blur-sm rounded-lg shadow-md border border-gray-100/50 min-h-[120px]";
  const labelClasses = "text-sm text-foreground/80 mb-1 flex items-center";
  const valueClasses = "text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r";
  const iconClasses = "w-5 h-5 mr-2 text-[#2B96F1]";

  return (
    <div className="w-full p-4 md:p-6 bg-white/60 backdrop-blur-md shadow-xl rounded-xl border border-gray-200/50">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-4">
        <div className={statItemClasses}>
          <span className={labelClasses}><GiftIcon className={iconClasses} />Initial {TOKEN_LABEL_AIR}</span>
          <p className={`${valueClasses} from-teal-400 to-sky-500`}>
            {initialAirdropAllocation?.toLocaleString() ?? 'N/A'}
          </p>
        </div>
        <div className={statItemClasses}>
          <span className={labelClasses}><CurrencyDollarIcon className={iconClasses} />DeFAI Balance</span>
          <p className={`${valueClasses} from-blue-400 to-cyan-500`}>
            {defaiBalance?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) ?? 'N/A'}
          </p>
        </div>
        <div className={statItemClasses}>
          <span className={labelClasses}><SparklesIcon className={iconClasses} />Your {TOKEN_LABEL_POINTS}</span>
          <p className={`${valueClasses} from-purple-400 to-pink-500`}>
            {userPoints?.toLocaleString() ?? 'N/A'}
          </p>
        </div>
      </div>

      <div className={`text-center p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-gray-100/50 shadow-sm mb-4`}>
        <div className={`flex items-center justify-center text-foreground/90 text-sm mb-1`}>
          <CalendarDaysIcon className="w-4 h-4 mr-1.5 text-[#2B96F1]" />
          <span>Snapshot on: <strong className={`text-[#2B96F1]`}>{snapshotDateString}</strong></span>
        </div>
        <p className={`text-foreground/80 text-xs leading-relaxed`}>
          Hold DeFAI for 1:1 {TOKEN_LABEL_AIR} <strong className={`text-[#2B96F1]`}>PLUS</strong> share of <strong className={`text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500`}>{(airdropPoolSize || 0).toLocaleString()} {TOKEN_LABEL_AIR}</strong> pool from {TOKEN_LABEL_POINTS}!
        </p>
      </div>

      <div className={`p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-gray-100/50 shadow-sm`}>
        <h3 className={`text-sm font-semibold text-center text-[#2B96F1] mb-1`}>Est. {TOKEN_LABEL_POINTS}-Based {TOKEN_LABEL_AIR}:</h3>
        <p className={`text-xl md:text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500`}>
          {pointsShare.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
        </p>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200/50 text-center">
        <p className={`text-foreground/90 text-md mb-1`}>Total Estimated {TOKEN_LABEL_AIR} Airdrop:</p>
        <p className={`text-4xl md:text-5xl font-extrabold font-orbitron text-transparent bg-clip-text bg-gradient-to-tr from-blue-500 via-sky-400 to-cyan-500 animate-pulse`}>
          {totalEstimatedAirdrop.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
        </p>
      </div>
    </div>
  );
};

export default AirdropSnapshotHorizontal; 