import React from 'react';
import { Input } from '../ui/input';
import { useHarvest } from '@/hooks/useHarvest';
import { PublicKey } from '@solana/web3.js';

interface HarvestModalProps {
  setIsHarvestModalOpen: (isOpen: boolean) => void;
  stakeEntryAddressFromPool?: string; // Optional: prefill from Pool component
}

export const HarvestModal: React.FC<HarvestModalProps> = ({
  setIsHarvestModalOpen,
  stakeEntryAddressFromPool,
}) => {
  const { harvest, isLoading } = useHarvest();
  const [stakeEntryAddress, setStakeEntryAddress] = React.useState(
    stakeEntryAddressFromPool || ''
  );

  const handleHarvest = async () => {
    if (!stakeEntryAddress) {
      console.error('Stake entry address is required for harvesting.');
      // Optionally, show a toast message to the user
      return;
    }
    try {
      setIsHarvestModalOpen(false);
      const stakeEntryKey = new PublicKey(stakeEntryAddress);
      const tx = await harvest(stakeEntryKey);
      console.log('Harvest successful:', tx);
    } catch (error) {
      console.error('Harvest failed:', error);
    }
  };

  return (
    <>
      <label className="text-sm font-medium text-foreground">Stake Entry Address
        <Input
          value={stakeEntryAddress}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setStakeEntryAddress(e.target.value)
          }
          placeholder="Enter stake entry address to harvest"
          className="mt-1"
          disabled={!!stakeEntryAddressFromPool} // Disable if prefilled
        />
      </label>
      <div className="mt-4 flex justify-end space-x-2">
        <button
          onClick={() => setIsHarvestModalOpen(false)}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={handleHarvest}
          disabled={isLoading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {isLoading ? 'Harvesting...' : 'Confirm Harvest'}
        </button>
      </div>
    </>
  );
}; 