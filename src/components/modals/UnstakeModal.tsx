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
  const { unstake } = useUnstake();
  const [stakeEntryAddress, setStakeEntryAddress] = React.useState('');

  const handleUnstake = async () => {
    try {
      setIsUnstakeModalOpen(false);
      const stakeEntryKey = new PublicKey(stakeEntryAddress);
      const tx = await unstake(stakeEntryKey);
      console.log('Unstake successful:', tx);
    } catch (error) {
      console.error('Unstake failed:', error);
    }
  };

  return (
    <>
      <label className="text-sm font-medium text-foreground">Stake Entry
        <Input
          value={stakeEntryAddress}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStakeEntryAddress(e.target.value)}
          placeholder="Enter stake entry address"
          className="mt-1"
        />
      </label>
      <div className="mt-4 flex justify-end space-x-2">
        <button
          onClick={() => setIsUnstakeModalOpen(false)}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={handleUnstake}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Confirm
        </button>
      </div>
    </>
  );
};