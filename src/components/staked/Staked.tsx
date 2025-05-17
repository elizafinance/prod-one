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
    // try {
    //   const stakeEntryKey = new PublicKey(stakeEntry);
    //   // const tx = await unstake(stakeEntryKey); // This call is now incorrect, needs positionMintAddress
    //   // console.log('Unstake successful:', tx);
    //   console.log('Unstake temporarily disabled in Staked.tsx: positionMintAddress is missing.');
    //   alert('Unstake functionality from this specific component view is temporarily disabled. Please use the main Unstake modal from the Pool view.');
    // } catch (error) {
    //   console.error('Unstake failed:', error);
    // }
    console.log('Unstake temporarily disabled in Staked.tsx: positionMintAddress is missing.');
    alert('Unstake functionality from this specific component view is temporarily disabled. Please use the main Unstake modal from the Pool view.');
  };
  return (
    <div className='flex justify-between items-center'>
      <p>You staked position with
        <Amount amount={Number(liquidity)} />
        liquidity
      </p>
      <button
        className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-text gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
        // onClick={() => handleUnstake()} // Temporarily disable direct unstake from here
        onClick={() => {
          console.log('Unstake button clicked in Staked.tsx - functionality via direct call is disabled.');
          alert('Unstake functionality from this specific component view is temporarily disabled. Please use the main Unstake modal from the Pool view if available, or await component refactor.');
        }}
      >
        Unstake
      </button>
    </div>
  );
}