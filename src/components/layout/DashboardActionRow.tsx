"use client";

import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { TOKEN_LABEL_AIR } from '@/lib/labels'; // Assuming you might use DeFAI label here
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Re-add tooltip imports

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
  onLogSocialAction: (actionType: 'shared_on_x' | 'followed_on_x' | 'joined_telegram') => void; // Added shared_on_x to type
  completedActions?: string[]; // Added prop
}

const DashboardActionRow: React.FC<DashboardActionRowProps> = ({
  isRewardsActive,
  currentTotalAirdropForSharing,
  onShareToX,
  onLogSocialAction,
  completedActions = [] // Added prop with default value
}) => {
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58();

  const buttonBaseClasses = "w-full sm:w-auto text-white font-bold py-3 px-6 rounded-full transition-all duration-150 ease-in-out hover:scale-105 hover:shadow-lg hover:shadow-blue-500/50 whitespace-nowrap bg-[#2563EB] flex items-center justify-center gap-2";
  const completedButtonClasses = "line-through opacity-60 pointer-events-none bg-gray-400 hover:shadow-none";

  const isFollowedOnX = completedActions.includes('followed_on_x');
  const isJoinedTelegram = completedActions.includes('joined_telegram');
  const isSharedOnX = completedActions.includes('shared_on_x');

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4 w-full my-6 md:my-8">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="https://dexscreener.com/solana/3jiwexdwzxjva2yd8aherfsrn7a97qbwmdz8i4q6mh7y" target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
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
                className={`${buttonBaseClasses} ${isSharedOnX ? completedButtonClasses : ''}`}
                disabled={isSharedOnX}
              >
                <ShareIcon /> Flex my {TOKEN_LABEL_AIR} on X
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isSharedOnX ? "You've already shared on X for points." : `Share your current ${TOKEN_LABEL_AIR} total on X. This action may earn you points!`}</p>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => { if (!isFollowedOnX) { window.open("https://x.com/defairewards", "_blank"); onLogSocialAction('followed_on_x');}}} 
              className={`${buttonBaseClasses} ${isFollowedOnX ? completedButtonClasses : ''}`}
              disabled={isFollowedOnX}
            >
              <XSocialIcon /> Follow on X
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isFollowedOnX ? "You've already followed on X." : "Follow @DeFAIRewards on X to stay updated and earn points."}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => { if(!isJoinedTelegram) { window.open("https://t.me/defairewards", "_blank"); onLogSocialAction('joined_telegram');}}} 
              className={`${buttonBaseClasses} ${isJoinedTelegram ? completedButtonClasses : ''}`}
              disabled={isJoinedTelegram}
            >
              <TelegramIcon /> Join Telegram
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isJoinedTelegram ? "You've already joined the Telegram." : "Join the DeFAI Rewards community on Telegram and earn points."}</p>
          </TooltipContent>
        </Tooltip>

        {walletAddress && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href={`/profile/${walletAddress}`} className="flex-shrink-0">
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