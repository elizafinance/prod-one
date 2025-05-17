'use client';
import React, { useState } from 'react';
import { Input } from '../ui/input';
import { useStake } from '@/hooks/useStake';
import { PublicKey } from '@solana/web3.js';

interface StakeModalProps {
  setIsStakeModalOpen: (isOpen: boolean) => void;
  setStakeEntryAccount: (stakeEntryAccount: { liquidity: bigint; pubKey: PublicKey }) => void;
}

export const StakeModal: React.FC<StakeModalProps> = ({
  setIsStakeModalOpen,
  setStakeEntryAccount
}) => {
  const { stake, positionMint, setPositionMint } = useStake();

  const [time, setTime] = useState('');

  const handleStake = async () => {
    try {
      setIsStakeModalOpen(false);

      const tx = await stake(time, setStakeEntryAccount);
      console.log('Stake successful:', tx);
    } catch (error) {
      console.error('Stake failed:', error);
    }
  };

  return (
    <>
      <label className="text-sm font-medium text-foreground">Duration (seconds)
        <Input type="number" value={time} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTime(e.target.value)} placeholder="Enter staking duration" className="mt-1" />
      </label>
      <label className="text-sm font-medium text-foreground mt-3">Position Mint
        <Input value={positionMint} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPositionMint(e.target.value)} placeholder="Enter staking position mint" className="mt-1" />
      </label>
      <div className="mt-4 flex justify-end space-x-2">
        <button
          onClick={() => setIsStakeModalOpen(false)}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Cancel
        </button>
        <button
          onClick={handleStake}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Confirm
        </button>
      </div>
    </>
  );
}