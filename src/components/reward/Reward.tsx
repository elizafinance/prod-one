import React from 'react';
import { Amount } from '../ui/amount';

interface RewardProps {
  coin: string;
  amount: number;
  rate: number;
}

export const Reward: React.FC<RewardProps> = props => {
  return (
    <div className="flex gap-4 items-center flex-col sm:flex-row">
      <span className='font-semi'>Rewards in {props.coin}:</span>
      <Amount amount={props.amount} currency={props.coin} isRemainder={true} />
      <span className="font-semi">Rewards per min: {props.rate}</span>
    </div>
  );
}