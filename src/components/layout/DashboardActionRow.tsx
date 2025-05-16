"use client";

import Link from 'next/link';
import { TOKEN_LABEL_AIR } from '@/lib/labels'; // Assuming you might use DeFAI label here

// Define simple icons for now, can be replaced with actual Heroicons or SVG components
const ChartIcon = () => <span>📊</span>;
const ShareIcon = () => <span>🔗</span>;
const XSocialIcon = () => <span>🐦</span>; // Changed from XIcon to avoid conflict if XIcon is used for close
const TelegramIcon = () => <span>✈️</span>;

interface DashboardActionRowProps {
  isRewardsActive: boolean;
  currentTotalAirdropForSharing: number;
  onShareToX: () => void;
  onLogSocialAction: (actionType: 'followed_on_x' | 'joined_telegram') => void;
}

const DashboardActionRow: React.FC<DashboardActionRowProps> = ({
  isRewardsActive,
  currentTotalAirdropForSharing,
  onShareToX,
  onLogSocialAction
}) => {
  return (
    <div className="flex flex-wrap justify-center gap-3 sm:gap-4 w-full my-6 md:my-8">
      <Link href="https://dexscreener.com/solana/3jiwexdwzxjva2yd8aherfsrn7a97qbwmdz8i4q6mh7y" target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
        <button 
          className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap bg-[#2563EB]"
        >
          <ChartIcon /> Buy DeFAI
        </button>
      </Link>
      
      {isRewardsActive && currentTotalAirdropForSharing > 0 && (
        <button 
          onClick={onShareToX} 
          className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap bg-[#2563EB]"
        >
          <ShareIcon /> Flex my {TOKEN_LABEL_AIR} on X
        </button>
      )}

      <button 
        onClick={() => { window.open("https://x.com/defairewards", "_blank"); onLogSocialAction('followed_on_x');}} 
        className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap bg-[#2563EB]"
      >
        <XSocialIcon /> Follow on X
      </button>

      <button 
        onClick={() => { window.open("https://t.me/defairewards", "_blank"); onLogSocialAction('joined_telegram');}} 
        className="w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap bg-[#2563EB]"
      >
        <TelegramIcon /> Join Telegram
      </button>
    </div>
  );
};

export default DashboardActionRow; 