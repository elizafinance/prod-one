"use client";

import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { TOKEN_LABEL_AIR } from '@/lib/labels';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useState } from 'react';

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
  const completedButtonClasses = "opacity-60 bg-gray-400 hover:shadow-none";
  const disabledButtonClasses = "opacity-60 pointer-events-none bg-gray-400 hover:shadow-none";

  const isFollowedOnX = completedActions.includes('followed_on_x');
  const isJoinedTelegram = completedActions.includes('joined_telegram');

  /* === Share-on-X Cool-down (24h) === */
  // Server enforces a 24 h cooldown. We fetch nextAvailableAt from the backend.

  const [shareCooldownExpiry, setShareCooldownExpiry] = useState<number | null>(null);

  // Fetch cooldown from backend on mount or when wallet changes
  useEffect(() => {
    const fetchCooldown = async () => {
      try {
        const res = await fetch('/api/cooldowns/share-on-x');
        if (!res.ok) return;
        const data = await res.json();
        if (data.nextAvailableAt) {
          const expiry = new Date(data.nextAvailableAt).getTime();
          if (!isNaN(expiry)) setShareCooldownExpiry(expiry);
        }
      } catch (err) {
        console.warn('[DashboardActionRow] Failed to fetch share cooldown', err);
      }
    };
    if (isRewardsActive) fetchCooldown();
  }, [isRewardsActive]);

  // Periodically clear expired cooldown
  useEffect(() => {
    if (!shareCooldownExpiry) return;
    const id = setInterval(() => {
      if (Date.now() >= shareCooldownExpiry) {
        setShareCooldownExpiry(null);
      }
    }, 60000);
    return () => clearInterval(id);
  }, [shareCooldownExpiry]);

  const handleShareWithCooldown = async () => {
    onShareToX();
    // After successful share, backend will log and set nextAvailableAt; fetch again to sync
    setTimeout(async () => {
      try {
        const res = await fetch('/api/cooldowns/share-on-x');
        const data = await res.json();
        if (data.nextAvailableAt) {
          setShareCooldownExpiry(new Date(data.nextAvailableAt).getTime());
        }
      } catch {}
    }, 1000);
  };

  const isShareOnCooldown = shareCooldownExpiry ? Date.now() < shareCooldownExpiry : false;
  const hoursRemaining = isShareOnCooldown ? Math.ceil((shareCooldownExpiry! - Date.now()) / (1000 * 60 * 60)) : 0;

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
                onClick={handleShareWithCooldown}
                className={`${buttonBaseClasses} ${isShareOnCooldown ? disabledButtonClasses : ''}`}
                disabled={isShareOnCooldown}
              >
                <ShareIcon /> Flex my {TOKEN_LABEL_AIR} on X
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {isShareOnCooldown
                  ? `Thanks for sharing! Come back in ${hoursRemaining}h to earn more points.`
                  : `Share your current ${TOKEN_LABEL_AIR} total on X to earn points (daily).`}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => {
                window.open("https://x.com/defairewards", "_blank");
                if (!isFollowedOnX) {
                  onLogSocialAction('followed_on_x');
                }
              }}
              className={`${buttonBaseClasses} ${isFollowedOnX ? completedButtonClasses : ''}`}
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
              onClick={() => {
                window.open("https://t.me/defairewards", "_blank");
                if (!isJoinedTelegram) {
                  onLogSocialAction('joined_telegram');
                }
              }}
              className={`${buttonBaseClasses} ${isJoinedTelegram ? completedButtonClasses : ''}`}
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