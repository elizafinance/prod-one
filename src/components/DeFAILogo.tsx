import React from 'react';

interface DeFAILogoProps {
  className?: string;
}

const DeFAILogo: React.FC<DeFAILogoProps> = ({ className = "" }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Gradient background circle */}
      <div className="absolute w-full h-full rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 animate-pulse-slow"></div>
      
      {/* Logo text */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
        <span className="text-3xl font-bold text-white">DeFAI</span>
        <span className="text-lg font-semibold text-white -mt-1">REWARDS</span>
      </div>
    </div>
  );
};

export default DeFAILogo; 