import React from 'react';
import { Amount } from '../ui/amount';
import { PublicKey } from '@solana/web3.js';
import { useUnstake } from '@/hooks/useUnstake';

interface UnstakedProps {
  liquidity: string;
  stakeEntry: PublicKey;
}
export const Staked: React.FC<UnstakedProps> = ({ liquidity, stakeEntry }) => {
  const { unstake } = useUnstake();

  const handleUnstake = async () => {
    try {
      const stakeEntryKey = new PublicKey(stakeEntry);
      const tx = await unstake(stakeEntryKey);
      console.log('Unstake successful:', tx);
    } catch (error) {
      console.error('Unstake failed:', error);
    }
  };
  return (
    <div className='flex justify-between items-center'>
      <p>You staked position with
        <Amount amount={Number(liquidity)} />
        liquidity
      </p>
      <button
        className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-text gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
        onClick={() => handleUnstake()}
      >
        Unstake
      </button>
    </div>
  );
}