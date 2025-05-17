import React from 'react';
import { Input } from '../ui/input';
import { useUnstake } from '@/hooks/useUnstake';
import { PublicKey } from '@solana/web3.js';

interface UnstakeModalProps {
  setIsUnstakeModalOpen: (isOpen: boolean) => void;
}

export const UnstakeModal: React.FC<UnstakeModalProps> = ({
  setIsUnstakeModalOpen
}) => {
  const { unstake, isLoading, error } = useUnstake();
  const [stakeEntryAddress, setStakeEntryAddress] = React.useState('');
  const [positionMintAddress, setPositionMintAddress] = React.useState('');

  const handleUnstake = async () => {
    if (!stakeEntryAddress || !positionMintAddress) {
        console.error("Stake Entry Address and Position Mint Address are required.");
        return;
    }
    try {
      const stakeEntryKey = new PublicKey(stakeEntryAddress);
      const positionMintKey = new PublicKey(positionMintAddress);
      const tx = await unstake(stakeEntryKey, positionMintKey);
      if (tx) {
        console.log('Unstake successful:', tx);
        setIsUnstakeModalOpen(false);
      }
    } catch (error) {
      console.error('Unstake failed in modal:', error);
    }
  };

  return (
    <>
      <label className="text-sm font-medium text-foreground">Stake Entry Address
        <Input
          value={stakeEntryAddress}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStakeEntryAddress(e.target.value)}
          placeholder="Enter stake entry address"
          className="mt-1"
        />
      </label>
      <label className="text-sm font-medium text-foreground mt-3">Position Mint Address
        <Input
          value={positionMintAddress}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPositionMintAddress(e.target.value)}
          placeholder="Enter position mint address"
          className="mt-1"
        />
      </label>
      {error && <p className="text-red-500 text-sm mt-2">Error: {error}</p>}
      <div className="mt-4 flex justify-end space-x-2">
        <button
          onClick={() => setIsUnstakeModalOpen(false)}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          onClick={handleUnstake}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Unstaking...' : 'Confirm Unstake'}
        </button>
      </div>
    </>
  );
};