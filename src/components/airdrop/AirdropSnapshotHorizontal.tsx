export interface AirdropSnapshotHorizontalProps {
  initialAirdropAllocation: number | null;
  defaiBalance: number | null;
  userPoints: number | null;
  totalCommunityPoints: number | null;
  airdropPoolSize: number;
  snapshotDateString: string;
  isLoading: boolean;
}

export default function AirdropSnapshotHorizontal({
  initialAirdropAllocation,
  defaiBalance,
  userPoints,
  totalCommunityPoints,
  airdropPoolSize,
  snapshotDateString,
  isLoading
}: AirdropSnapshotHorizontalProps) {
  // ... rest of the component implementation ...
} 