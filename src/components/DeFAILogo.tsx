import React from 'react';

interface DeFAILogoProps {
  className?: string;
  /** Additional Tailwind classes for the inner text – e.g. "text-black". Defaults to "text-white". */
  textClassName?: string;
}

const DeFAILogo: React.FC<DeFAILogoProps> = ({ className = "", textClassName = "text-white" }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Gradient background circle */}
      <div className="absolute w-full h-full rounded-full bg-gradient-to-br from-[#2563EB] to-black animate-pulse-slow"></div>
      
      {/* Logo text */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
        <span className={`text-3xl font-bold font-orbitron ${textClassName}`}>DEFAI</span>
        <span className={`text-lg font-semibold font-orbitron -mt-1 ${textClassName}`}>REWARDS</span>
      </div>
    </div>
  );
};

export default DeFAILogo; 