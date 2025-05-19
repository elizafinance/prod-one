"use client";

import { useUserAirdrop } from '@/hooks/useUserAirdrop';
import { AIR } from '@/config/points.config';
import { formatPoints } from '@/lib/utils';
import { SparklesIcon, CurrencyDollarIcon, GiftIcon, CalendarDaysIcon, UserGroupIcon, CubeTransparentIcon } from '@heroicons/react/24/outline';
import DashboardCard from './DashboardCard';
import KpiTile from './KpiTile';
import { Skeleton } from '@/components/ui/skeleton';

interface AirdropSnapshotHorizontalProps {
  defaiBalance: number | null;
  totalCommunityPoints: number | null;
  airdropPoolSize: number;
  snapshotDateString: string;
  // isLoading prop from parent to control overall display readiness if needed
  // For now, relying on isUserAirdropLoading and individual data points for KpiTile isLoading states
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
    airBasedDefai,
    totalDefai, // This is initialDefai + airBasedDefai from the hook
    isLoading: isUserAirdropLoading, 
    error: userAirdropError 
  } = useUserAirdrop();

  // isLoading for KpiTiles can be more granular based on specific data points
  const isLoadingOverallHook = isUserAirdropLoading;

  // Recalculate grand total including current DEFAI balance for display here
  const finalTotalEstimatedAirdrop = (totalDefai ?? 0) + (defaiBalance ?? 0);

  if (userAirdropError) {
    return (
      <DashboardCard title={`Your ${AIR.LABEL} Snapshot`} className="bg-destructive-subtle border-destructive/30">
        <p className="text-destructive-emphasis text-center py-4">Could not load all airdrop details at this time.</p>
        {/* Optionally show defaiBalance if available and not part of error */}
        {defaiBalance !== null && (
            <KpiTile 
                title="DeFAI Balance" 
                value={formatPoints(defaiBalance)} 
                unit="$DEFAI" 
                icon={CurrencyDollarIcon} 
                isLoading={false} // Assuming defaiBalance itself is not from the errored hook
                aspectRatio="aspect-auto" // Or keep square, but make it a single item row if error
                className="mt-4" 
            />
        )}
      </DashboardCard>
    );
  }

  return (
    <DashboardCard title={`Your ${AIR.LABEL} Snapshot`} className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <KpiTile 
          title={`Initial ${AIR.LABEL}`}
          value={initialDefai !== null ? formatPoints(initialDefai) : undefined} 
          unit={AIR.LABEL} 
          icon={GiftIcon} 
          isLoading={isLoadingOverallHook}
        />
        <KpiTile 
          title="Your Points" 
          value={points !== null ? formatPoints(points) : undefined} 
          unit={AIR.LABEL} 
          icon={SparklesIcon} 
          isLoading={isLoadingOverallHook}
        />
        <KpiTile 
          title="DeFAI Balance" 
          value={defaiBalance !== null ? formatPoints(defaiBalance) : undefined} 
          unit="$DEFAI" 
          icon={CurrencyDollarIcon} 
          isLoading={defaiBalance === null} // isLoading if parent hasn't supplied it yet
        />
        <KpiTile 
          title={`Est. ${AIR.LABEL}-Based`}
          value={airBasedDefai !== null ? formatPoints(airBasedDefai) : undefined} 
          unit={AIR.LABEL} 
          icon={CubeTransparentIcon} 
          isLoading={isLoadingOverallHook} 
        />
        <KpiTile 
          title="Community Points" 
          value={totalCommunityPoints !== null ? formatPoints(totalCommunityPoints) : undefined} 
          unit={AIR.LABEL} 
          icon={UserGroupIcon} 
          isLoading={totalCommunityPoints === null} 
        />
        <KpiTile 
          title="Snapshot Date" 
          value={snapshotDateString} 
          icon={CalendarDaysIcon} 
          isLoading={isLoadingOverallHook} // Assuming date isn't dynamic post-load
          aspectRatio="aspect-auto" 
          titleClassName="text-xs text-muted-foreground mb-0.5" 
          valueClassName="text-sm font-semibold mt-0.5" 
          className="p-3 sm:p-3" // Slightly less padding for this text-heavy tile
        />
      </div>
      
      <div className="text-center p-3 bg-background/30 backdrop-blur-sm rounded-lg border border-border/50 shadow-inner mb-6">
        <p className={`text-foreground/80 text-xs leading-relaxed`}>
          Hold DeFAI for 1:1 {AIR.LABEL} <strong className={`text-defai_primary`}>PLUS</strong> share of <strong className={`text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500`}>{formatPoints(airdropPoolSize)} {AIR.LABEL}</strong> pool from points!
        </p>
      </div>

      <div className="mt-4 pt-4 border-t border-border/50 text-center">
        <p className={`text-foreground/90 text-base mb-1`}>Total Estimated {AIR.LABEL} Airdrop:</p>
        {isLoadingOverallHook && finalTotalEstimatedAirdrop === 0 ? (
            <Skeleton className="h-10 w-1/2 mx-auto rounded-md"/>
        ) : (
            <p className={`text-4xl md:text-5xl font-extrabold font-orbitron text-transparent bg-clip-text bg-gradient-to-tr from-blue-500 via-sky-400 to-cyan-500 animate-pulse`}>
            {formatPoints(finalTotalEstimatedAirdrop)}
            </p>
        )}
      </div>
    </DashboardCard>
  );
};

export default AirdropSnapshotHorizontal; 