import React from "react";

export interface AmountProps {
  amount?: number | null;
  currency?: string;
  isRemainder?: boolean;
}

// Very lightweight replacement until real component is built.
export const Amount: React.FC<AmountProps> = ({ amount = 0, currency = "", isRemainder }) => {
  if (amount === null || amount === undefined) {
    return <span>-</span>;
  }
  const formatted = amount.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return (
    <span>
      {formatted} {currency}
      {isRemainder && '+'}
    </span>
  );
}; 