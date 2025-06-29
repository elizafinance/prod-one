'use client';

import { useState } from 'react';
import { toast } from 'sonner';

interface SquadTierManagerProps {
  squadId: string;
  currentTier: number;
  squadName: string;
  onUpdate?: () => void;
}

export default function SquadTierManager({ squadId, currentTier, squadName, onUpdate }: SquadTierManagerProps) {
  const [selectedTier, setSelectedTier] = useState(currentTier);
  const [isUpdating, setIsUpdating] = useState(false);

  const tierInfo = [
    { tier: 0, name: 'No Tier', maxMembers: 0, color: 'text-gray-500' },
    { tier: 1, name: 'Tier 1', maxMembers: 10, color: 'text-bronze' },
    { tier: 2, name: 'Tier 2', maxMembers: 50, color: 'text-silver' },
    { tier: 3, name: 'Tier 3', maxMembers: 100, color: 'text-gold' },
  ];

  const handleUpdateTier = async () => {
    if (selectedTier === currentTier) {
      toast.info('Please select a different tier');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch('/api/admin/squads/set-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadId, tier: selectedTier })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success(`Squad "${squadName}" updated to ${tierInfo[selectedTier].name}`);
        if (onUpdate) onUpdate();
      } else {
        toast.error(data.error || 'Failed to update squad tier');
      }
    } catch (error) {
      console.error('Error updating squad tier:', error);
      toast.error('An error occurred while updating tier');
    }
    setIsUpdating(false);
  };

  return (
    <div className="p-4 bg-card border border-border rounded-lg">
      <h3 className="text-sm font-semibold text-foreground mb-3">Squad Tier Management</h3>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Current Tier</label>
          <p className={`font-semibold ${tierInfo[currentTier].color}`}>
            {tierInfo[currentTier].name} (Max {tierInfo[currentTier].maxMembers} members)
          </p>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Set New Tier</label>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(Number(e.target.value))}
            className="w-full p-2 bg-background border border-input rounded-md text-foreground focus:ring-2 focus:ring-primary"
            disabled={isUpdating}
          >
            {tierInfo.map((tier) => (
              <option key={tier.tier} value={tier.tier}>
                {tier.name} - Max {tier.maxMembers} members
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleUpdateTier}
          disabled={isUpdating || selectedTier === currentTier}
          className="w-full py-2 px-4 bg-primary hover:bg-primary/80 text-primary-foreground font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isUpdating ? 'Updating...' : 'Update Tier'}
        </button>
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        Note: This will override the automatic tier calculation based on points.
      </p>
    </div>
  );
}