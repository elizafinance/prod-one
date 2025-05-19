"use client";

import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { TOKEN_LABEL_AIR } from '@/lib/labels'; // Assuming you might use DeFAI label here
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // Assuming Shadcn UI Tooltip

// Define simple icons for now, can be replaced with actual Heroicons or SVG components
const ChartIcon = () => <span>📊</span>;
const ShareIcon = () => <span>🔗</span>;
const XSocialIcon = () => <span>🐦</span>; // Changed from XIcon to avoid conflict if XIcon is used for close
const TelegramIcon = () => <span>✈️</span>;
const ShowcaseIcon = () => <span>🖼️</span>;

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
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();

  const buttonBaseClasses = "flex-shrink-0 text-primary-foreground font-bold py-3 px-5 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg whitespace-nowrap bg-primary hover:shadow-primary/50 snap-center text-sm sm:text-base flex items-center gap-2"; // Added flex items-center gap-2

  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-full flex overflow-x-auto space-x-3 sm:space-x-4 py-2 snap-x snap-mandatory hide-scrollbar my-6 md:my-8 pl-4 pr-4 sm:justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="https://dexscreener.com/solana/3jiwexdwzxjva2yd8aherfsrn7a97qbwmdz8i4q6mh7y" target="_blank" rel="noopener noreferrer" className="snap-start">
              <button className={`${buttonBaseClasses}`}>
                <ChartIcon /> Buy DeFAI
              </button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            <p>Purchase $DEFAI tokens on Raydium via DexScreener.</p>
          </TooltipContent>
        </Tooltip>
        
        {isRewardsActive && currentTotalAirdropForSharing > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                onClick={onShareToX} 
                className={`${buttonBaseClasses}`}
              >
                <ShareIcon /> Flex my {TOKEN_LABEL_AIR} on X
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Share your current {TOKEN_LABEL_AIR} total on X (Twitter). This action may earn you points!</p>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => { window.open("https://x.com/defairewards", "_blank"); onLogSocialAction('followed_on_x');}} 
              className={`${buttonBaseClasses}`}
            >
              <XSocialIcon /> Follow on X
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Follow @DeFAIRewards on X (Twitter) to stay updated and earn points.</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => { window.open("https://t.me/defairewards", "_blank"); onLogSocialAction('joined_telegram');}} 
              className={`${buttonBaseClasses}`}
            >
              <TelegramIcon /> Join Telegram
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Join the DeFAI Rewards community on Telegram and earn points.</p>
          </TooltipContent>
        </Tooltip>

        {walletAddress && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={`/profile/${walletAddress}`} className="snap-end">
                <button className={`${buttonBaseClasses}`}>
                  <ShowcaseIcon /> My Showcase
                </button>
              </Link>
            </TooltipTrigger>
            <TooltipContent>
              <p>View your public DeFAI Rewards profile and showcase.</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
};

export default DashboardActionRow; 