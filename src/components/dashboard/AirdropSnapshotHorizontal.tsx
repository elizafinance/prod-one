"use client";

import { useUserAirdrop, UserAirdropData } from '@/hooks/useUserAirdrop';
import { AIR } from '@/config/points.config';
import { formatPoints } from '@/lib/utils';
import { SparklesIcon, CurrencyDollarIcon, GiftIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

interface AirdropSnapshotHorizontalProps {
  // Props that are not from useUserAirdrop hook
  defaiBalance: number | null;
  totalCommunityPoints: number | null; // For calculating share, might come from global state/props
  airdropPoolSize: number; // For calculating share, might come from global state/props
  snapshotDateString: string;
  // isLoading prop might be redundant if hook handles its own loading state for its data
}

const AirdropSnapshotHorizontal: React.FC<AirdropSnapshotHorizontalProps> = ({
  defaiBalance,
  totalCommunityPoints,
  airdropPoolSize,
  snapshotDateString,
}) => {
  const { 
    initialDefai, 
    points,
    airBasedDefai, // This is already calculated by the hook based on POINT_TO_DEFAI_RATIO
    totalDefai,    // This is also calculated by the hook
    isLoading: isUserAirdropLoading, 
    error: userAirdropError 
  } = useUserAirdrop();

  // Overall loading state can consider the hook's loading state
  const isLoading = isUserAirdropLoading; // Or combine with other loading states if component has more

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 p-4 md:p-6 bg-white/60 backdrop-blur-md shadow-xl rounded-xl border border-gray-200/50 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-200/50 rounded-lg"></div>
        ))}
      </div>
    );
  }
  
  if (userAirdropError) {
    // Optional: Display a specific error message from the hook
    // console.error("AirdropSnapshot Error:", userAirdropError);
    // For now, falling back to N/A for values if hook errors out or data is null
  }

  // The hook now provides airBasedDefai and totalDefai directly.
  // If the definition of pointsShare here is different than POINT_TO_DEFAI_RATIO, this needs reconciling.
  // For now, assuming airBasedDefai from the hook is what we need for "Est. AIR-Based DEFAI".
  // const pointsShare = airBasedDefai ?? 0;
  // totalEstimatedAirdrop is now `totalDefai` from the hook, IF defaiBalance is incorporated there.
  // If not, we recalculate total here. Let's assume useUserAirdrop's `totalDefai` is `initialDefai + airBasedDefai`.
  // We need to add `defaiBalance` to this for the grand total shown in this component.
  const finalTotalEstimatedAirdrop = (totalDefai ?? 0) + (defaiBalance ?? 0);


  const statItemClasses = "flex flex-col items-center justify-center p-4 bg-white/20 backdrop-blur-sm rounded-lg shadow-md border border-gray-100/50 min-h-[120px]";
  const labelClasses = "text-sm text-foreground/80 mb-1 flex items-center";
  const valueClasses = "text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r";
  const iconClasses = "w-5 h-5 mr-2 text-[#2B96F1]";

  return (
    <div className="w-full p-4 md:p-6 bg-white/60 backdrop-blur-md shadow-xl rounded-xl border border-gray-200/50">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-4">
        <div className={statItemClasses}>
          <span className={labelClasses}><GiftIcon className={iconClasses} />Initial {AIR.LABEL}</span>
          <p className={`${valueClasses} from-teal-400 to-sky-500`}>
            {initialDefai !== null ? formatPoints(initialDefai) : 'N/A'}
          </p>
        </div>
        <div className={statItemClasses}>
          <span className={labelClasses}><CurrencyDollarIcon className={iconClasses} />DeFAI Balance</span>
          <p className={`${valueClasses} from-blue-400 to-cyan-500`}>
            {defaiBalance !== null ? formatPoints(defaiBalance) : 'N/A'}
          </p>
        </div>
        <div className={statItemClasses}>
          <span className={labelClasses}><SparklesIcon className={iconClasses} />Your {AIR.LABEL}</span>
          <p className={`${valueClasses} from-purple-400 to-pink-500`}>
            {points !== null ? formatPoints(points) : 'N/A'}
          </p>
        </div>
      </div>

      <div className={`text-center p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-gray-100/50 shadow-sm mb-4`}>
        <div className={`flex items-center justify-center text-foreground/90 text-sm mb-1`}>
          <CalendarDaysIcon className="w-4 h-4 mr-1.5 text-[#2B96F1]" />
          <span>Snapshot on: <strong className={`text-[#2B96F1]`}>{snapshotDateString}</strong></span>
        </div>
        <p className={`text-foreground/80 text-xs leading-relaxed`}>
          Hold DeFAI for 1:1 {AIR.LABEL} <strong className={`text-[#2B96F1]`}>PLUS</strong> share of <strong className={`text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500`}>{formatPoints(airdropPoolSize)} {AIR.LABEL}</strong> pool from {AIR.LABEL} points!
        </p>
      </div>

      <div className={`p-3 bg-white/20 backdrop-blur-sm rounded-lg border border-gray-100/50 shadow-sm`}>
        <h3 className={`text-sm font-semibold text-center text-[#2B96F1] mb-1`}>Est. {AIR.LABEL}-Based DeFAI:</h3>
        <p className={`text-xl md:text-2xl font-bold text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500`}>
          {airBasedDefai !== null ? formatPoints(airBasedDefai) : '0'}
        </p>
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200/50 text-center">
        <p className={`text-foreground/90 text-md mb-1`}>Total Estimated {AIR.LABEL} Airdrop:</p>
        <p className={`text-4xl md:text-5xl font-extrabold font-orbitron text-transparent bg-clip-text bg-gradient-to-tr from-blue-500 via-sky-400 to-cyan-500 animate-pulse`}>
          {formatPoints(finalTotalEstimatedAirdrop)}
        </p>
      </div>
    </div>
  );
};

export default AirdropSnapshotHorizontal; 