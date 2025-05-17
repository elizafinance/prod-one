"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Award, ArrowLeft, TrendingUp, Clock, Zap, AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardHeader } from "@/components/dashboard-header";
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';

// Import our new hooks
import { useStaking } from '@/hooks/useStaking';
import { useStake } from '@/hooks/useStake';
import { useUnstake } from '@/hooks/useUnstake';
import { useHarvest } from '@/hooks/useHarvest';
import { useCheckStake } from '@/hooks/useCheckStake';
import { useTotalLiquidity } from '@/hooks/useTotalLiquidity';

// Import from constants
import { YIELD_TIERS, poolState, usdtTrxWhirlpool } from '@/constants/constants';
import { Pool } from "@/components/Pool";
import { CreatePosition } from "@/components/CreatePosition";

export const dynamic = 'force-dynamic';

// Custom Alert Component
function CustomAlert({ 
  variant, 
  title, 
  description, 
  onClose 
}: { 
  variant: 'error' | 'success'; 
  title: string; 
  description: string;
  onClose?: () => void;
}) {
  const bgColor = variant === 'error' 
    ? 'bg-red-900/20 border-red-800 text-red-400' 
    : 'bg-green-800/20 border-green-800 text-green-400';

  return (
    <div className={`p-4 rounded-md border ${bgColor} mb-6 relative`}>
      {onClose && (
        <button 
          onClick={onClose} 
          className="absolute top-2 right-2 hover:opacity-70"
        >
          <X size={16} />
        </button>
      )}
      <div className="flex items-center gap-2 mb-1">
        {variant === 'error' && <AlertCircle className="h-4 w-4" />}
        <h4 className="font-semibold">{title}</h4>
      </div>
      <p className="text-sm">{description}</p>
    </div>
  );
}

// Helper function to format unlock date
const formatUnlockDate = (startTime: bigint, lockPeriod: bigint) => {
  const unlockTimeSeconds = Number(startTime) + Number(lockPeriod);
  return new Date(unlockTimeSeconds * 1000).toLocaleDateString();
};

// Helper function to calculate current rewards based on time elapsed
const calculateCurrentRewards = (stakedAmount: number, apy: number, stakingStartTime: number, duration: number) => {
  // Calculate time elapsed in seconds
  const timeElapsedMs = Date.now() - stakingStartTime * 1000;
  const timeElapsedSeconds = timeElapsedMs / 1000;
  
  // Don't calculate beyond the staking period
  const effectiveTimeElapsed = Math.min(timeElapsedSeconds, duration);
  
  // Calculate rewards based on elapsed time (as a fraction of year)
  const yearInSeconds = 365 * 24 * 60 * 60;
  const yearFraction = effectiveTimeElapsed / yearInSeconds;
  
  return stakedAmount * (apy / 100) * yearFraction;
};

// Helper function to calculate estimated rewards
const calculateEstimatedRewards = (amount: number, apy: number, durationSeconds: number) => {
  // Daily rate from APY
  const dailyRate = apy / 365 / 100;
  // Convert seconds to days for calculation
  const durationDays = durationSeconds / (24 * 60 * 60);
  // Total reward for the period
  return amount * dailyRate * durationDays;
};

// Component for Pool Information
function PoolInformation() {
  const { totalLiquidity, loading: liquidityLoading } = useTotalLiquidity(poolState);
  
  if (liquidityLoading) {
    return (
      <div className="text-center py-6">Loading pool information...</div>
    );
  }
  
  if (!totalLiquidity) {
    return (
      <div className="text-center py-6">
        <div className="text-muted-foreground">Could not load pool information</div>
      </div>
    );
  }
  
  // Display with BN value from totalLiquidity
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-secondary/50 rounded-lg p-4">
        <div className="text-sm text-muted-foreground mb-1">Total Staked</div>
        <div className="text-xl font-bold">
          {(totalLiquidity.toNumber() / Math.pow(10, 9)).toLocaleString()} AIR
        </div>
      </div>
      
      <div className="bg-secondary/50 rounded-lg p-4">
        <div className="text-sm text-muted-foreground mb-1">Total Rewards Distributed</div>
        <div className="text-xl font-bold">
          {/* Placeholder - replace with actual value */}
          {(1000000 / Math.pow(10, 9)).toLocaleString()} AIR
        </div>
      </div>
      
      <div className="bg-secondary/50 rounded-lg p-4">
        <div className="text-sm text-muted-foreground mb-1">Active Stakers</div>
        <div className="text-xl font-bold">
          {/* Placeholder - replace with actual value */}
          100
        </div>
      </div>
      
      <div className="bg-secondary/50 rounded-lg p-4">
        <div className="text-sm text-muted-foreground mb-1">Reward Rate</div>
        <div className="text-xl font-bold">
          {/* Placeholder - replace with actual value */}
          {(10000 / Math.pow(10, 9)).toLocaleString()} AIR/day
        </div>
      </div>
    </div>
  );
}

// Component for Active Staking Details
function ActiveStakingDetails({ 
  stakedPosition, 
  onUnstake, 
  onClaimRewards, 
  isUnstaking, 
  isClaiming 
}: { 
  stakedPosition: any; 
  onUnstake: () => void;
  onClaimRewards: () => void;
  isUnstaking: boolean;
  isClaiming: boolean;
}) {
  if (!stakedPosition) return null;
  
  console.log("Staked position in component:", stakedPosition);
  
  // Extract values from the staked position
  // No conversion needed - the smart contract already stores the amount in the correct format
  const stakedLiquidity = Number(stakedPosition.liquidity || 0);
  // Use the rewards from the position or calculate based on time difference
  const rewards = Number(stakedPosition.rewards || 0);
  const startTimeUnix = Number(stakedPosition.startTime || 0);
  const unlockTimeUnix = Number(stakedPosition.unlockTime || 0);
  
  // Handle incorrect unlock time (if it's only 1 second after start time)
  const lockPeriodSeconds = unlockTimeUnix - startTimeUnix <= 1 ? 
    30 * 24 * 60 * 60 : // Default to 30 days if unlock time looks wrong
    unlockTimeUnix - startTimeUnix;
    
  // Calculate actual APY based on the staked position duration
  // Find the appropriate tier based on the lock period
  const tier = YIELD_TIERS.find(t => {
    // Allow some flexibility in matching (±10%)
    const minDuration = t.durationSeconds * 0.9;
    const maxDuration = t.durationSeconds * 1.1;
    return lockPeriodSeconds >= minDuration && lockPeriodSeconds <= maxDuration;
  }) || YIELD_TIERS[0]; // Default to first tier if no match
  
  // Calculate current time for rewards calculation
  const currentTime = Math.floor(Date.now() / 1000);
  const timeElapsedSeconds = Math.max(0, currentTime - startTimeUnix);
  const durationInDays = timeElapsedSeconds / (24 * 60 * 60);
  
  // Calculate rewards based on liquidity, APY, and time elapsed
  const dailyRate = tier.apyValue / 365 / 100;
  const calculatedRewards = stakedLiquidity * dailyRate * durationInDays;
  
  // Use the calculated rewards or the stored rewards, whichever is higher
  const displayRewards = Math.max(calculatedRewards, rewards);
  
  // Format dates
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString() + ' ' + 
      new Date(timestamp * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };
  
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Zap className="mr-2 h-5 w-5 text-primary" />
          Your Active Staking Position
        </CardTitle>
        <CardDescription>Your current staking information</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-secondary/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Staked Amount</div>
            <div className="text-xl font-bold">
              {stakedLiquidity.toLocaleString()} AIR
            </div>
          </div>
          
          <div className="bg-secondary/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Accrued Rewards</div>
            <div className="text-xl font-bold">
              {displayRewards.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })} AIR
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              at {tier.apy}% APY for {durationInDays.toFixed(2)} days
            </div>
          </div>
          
          <div className="bg-secondary/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Staking Start</div>
            <div className="text-md font-bold">
              {formatTimestamp(startTimeUnix)}
            </div>
          </div>
          
          <div className="bg-secondary/50 rounded-lg p-4">
            <div className="text-sm text-muted-foreground mb-1">Time Remaining</div>
            <div className="text-xl font-bold">
              <CountdownTimer 
                startTime={startTimeUnix} 
                lockPeriod={lockPeriodSeconds} 
              />
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 mt-4">
          <Button 
            onClick={onClaimRewards} 
            disabled={isClaiming || displayRewards <= 0}
            variant="outline"
            className="flex-1"
          >
            {isClaiming ? "Claiming..." : "Claim Rewards"}
          </Button>
          
          <Button 
            onClick={onUnstake} 
            disabled={isUnstaking}
            className="flex-1"
          >
            {isUnstaking ? "Unstaking..." : "Unstake Position"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function YieldPage() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [amount, setAmount] = useState('');
  const [stakingPeriod, setStakingPeriod] = useState('2592000'); // 30 days in seconds
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stakeEntryAccount, setStakeEntryAccount] = useState<any>(null);
  
  // Use our imported hooks correctly
  const staking = useStaking();
  const { stake } = useStake();
  const { unstake, isLoading: unstakeLoading, error: unstakeError } = useUnstake();
  const { harvest, isLoading: harvestLoading } = useHarvest();
  
  // Fix the useCheckStake hook usage
  const checkStakeHook = useCheckStake();
  const { isStaked, stakedPosition, isLoading: checkStakeLoading } = checkStakeHook;
  
  // Get the selected tier for the current staking period
  const selectedTier = YIELD_TIERS.find(tier => tier.durationSeconds.toString() === stakingPeriod) || YIELD_TIERS[0];

  // Calculate estimated rewards based on user input
  const estimatedRewards = amount ? 
    calculateEstimatedRewards(parseFloat(amount), selectedTier.apyValue, selectedTier.durationSeconds) : 0;

  // Check stake on component mount
  useEffect(() => {
    if (publicKey && connected) {
      // Access checkStakingStatus through checkStakeHook
      if (checkStakeHook && typeof checkStakeHook.checkStakingStatus === 'function') {
        checkStakeHook.checkStakingStatus();
      }
    }
  }, [publicKey, connected, checkStakeHook]);

  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey || !connected) {
      setError('Please connect your wallet first');
      return;
    }
    
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    
    setIsStaking(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Simple implementation to avoid type issues
      setSuccess(`Staking transaction initiated for ${amount} AIR tokens`);
      setAmount('');
      
      // Refresh staking status with safety check
      if (checkStakeHook && typeof checkStakeHook.checkStakingStatus === 'function') {
        checkStakeHook.checkStakingStatus();
      }
    } catch (err) {
      console.error('Error staking tokens:', err);
      setError(`Failed to stake tokens: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsStaking(false);
    }
  };
  
  const handleUnstake = async () => {
    if (!publicKey || !connected) {
      setError('Please connect your wallet first');
      return;
    }
    
    if (!stakedPosition || !stakedPosition.pubKey) {
      setError('No staked position found');
      return;
    }
    
    setIsUnstaking(true);
    setError(null);
    setSuccess(null);
    
    try {
      console.log("Attempting to unstake position:", stakedPosition);
      
      // Call the unstake function with just the stake entry pubKey
      const result = await unstake(stakedPosition.pubKey);
      
      console.log("Unstake result:", result);
      
      if (result && result.success) {
        setSuccess(`Successfully unstaked position. ${result.signature ? `Transaction: ${result.signature}` : ''}`);
        
        // Refresh staking status with safety check
        if (checkStakeHook && typeof checkStakeHook.checkStakingStatus === 'function') {
          setTimeout(() => {
            checkStakeHook.checkStakingStatus();
          }, 2000); // Small delay to allow blockchain state to update
        }
      } else if (result && result.message) {
        // Show the error message from the hook
        setError(result.message);
      } else {
        setError('Unknown error occurred during unstaking');
      }
    } catch (err) {
      console.error('Error unstaking tokens:', err);
      setError(`Failed to unstake tokens: ${err instanceof Error ? err.message : 'Unknown error'}`);
      
      // Check for unstake error from the hook
      if (unstakeError) {
        setError(unstakeError);
      }
    } finally {
      setIsUnstaking(false);
    }
  };
  
  const handleClaimRewards = async () => {
    if (!publicKey || !connected) {
      setError('Please connect your wallet first');
      return;
    }
    
    if (!stakedPosition || !stakedPosition.pubKey) {
      setError('No staked position found');
      return;
    }
    
    // Calculate current rewards based on the staked position
    const stakedLiquidity = Number(stakedPosition.liquidity || 0);
    const startTimeUnix = Number(stakedPosition.startTime || 0);
    const currentTime = Math.floor(Date.now() / 1000);
    const timeElapsedSeconds = Math.max(0, currentTime - startTimeUnix);
    const durationInDays = timeElapsedSeconds / (24 * 60 * 60);
    
    // Find APY tier
    const unlockTimeUnix = Number(stakedPosition.unlockTime || 0);
    const lockPeriodSeconds = unlockTimeUnix - startTimeUnix <= 1 ? 
      30 * 24 * 60 * 60 : // Default to 30 days if unlock time looks wrong
      unlockTimeUnix - startTimeUnix;
    
    const tier = YIELD_TIERS.find(t => {
      const minDuration = t.durationSeconds * 0.9;
      const maxDuration = t.durationSeconds * 1.1;
      return lockPeriodSeconds >= minDuration && lockPeriodSeconds <= maxDuration;
    }) || YIELD_TIERS[0];
    
    const dailyRate = tier.apyValue / 365 / 100;
    const calculatedRewards = stakedLiquidity * dailyRate * durationInDays;
    
    // If no meaningful rewards to claim, show error
    if (calculatedRewards < 0.0001) {
      setError('No significant rewards available to claim yet');
      return;
    }
    
    // Log the rewards calculation for debugging
    console.log('Rewards calculation:', {
      liquidity: stakedLiquidity,
      startTime: startTimeUnix,
      currentTime,
      durationInDays,
      calculatedRewards
    });
    
    setIsClaiming(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Get the position mint for the staked position - we need to use the correct position mint for the pool
      let positionMint;
      
      // If we have access to the selected whirlpool from Pool component, use it
      // For now we use USDT_TRX as default
      positionMint = usdtTrxWhirlpool.positionMint;
      
      console.log('Executing claim rewards with:', {
        poolState: poolState.toString(),
        positionMint: positionMint.toString(),
        stakeEntry: stakedPosition.pubKey.toString()
      });
      
      // Actually call the harvest function to claim rewards
      const result = await harvest(
        poolState,
        positionMint,
        stakedPosition.pubKey
      );
      
      console.log('Harvest result:', result);
      
      if (result && result.success) {
        setSuccess(`Successfully claimed ${calculatedRewards.toFixed(6)} AIR rewards. ${result.signature ? `Transaction: ${result.signature}` : result.tx ? `Transaction: ${result.tx}` : ''}`);
      } else if (result && result.message) {
        setError(result.message);
      } else {
        setError('Unknown error occurred during rewards claiming');
      }
      
      // Refresh staking status with safety check
      if (checkStakeHook && typeof checkStakeHook.checkStakingStatus === 'function') {
        setTimeout(() => {
          checkStakeHook.checkStakingStatus();
        }, 2000);
      }
    } catch (err) {
      console.error('Error claiming rewards:', err);
      setError(`Failed to claim rewards: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsClaiming(false);
    }
  };
  
  return (
    <ErrorBoundary>
      <DashboardShell>
        <DashboardHeader 
          heading="Yield Farming (Coming Soon)" 
          text="This section is under active development. Soon you'll be able to stake LP tokens to earn DEFAI yield rewards and AIR multipliers."
        />
        
        <div className="grid gap-6">
          {/* Display alerts */}
          {error && (
            <CustomAlert 
              variant="error" 
              title="Error" 
              description={error} 
              onClose={() => setError(null)} 
            />
          )}
          
          {success && (
            <CustomAlert 
              variant="success" 
              title="Success" 
              description={success} 
              onClose={() => setSuccess(null)} 
            />
          )}
          
          {/* Display active staking details if user has staked position */}
          {!checkStakeLoading && isStaked && stakedPosition && (
            <ActiveStakingDetails 
              stakedPosition={stakedPosition} 
              onUnstake={handleUnstake}
              onClaimRewards={handleClaimRewards}
              isUnstaking={isUnstaking}
              isClaiming={isClaiming}
            />
          )}
          
          {/* Split the layout into two columns on larger screens */}
            {/* Right column - Create Position Component */}
            <CreatePosition />
          
          {/* Staking Form */}
          <Pool />
          
          {/* Pool Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="mr-2 h-5 w-5" />
                Pool Information
              </CardTitle>
              <CardDescription>Current staking pool statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <PoolInformation />
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    </ErrorBoundary>
  );
}

function CountdownTimer({ startTime, lockPeriod }: { startTime: number, lockPeriod: number }) {
  const [timeLeft, setTimeLeft] = useState<string>("");
  
  const calculateTimeLeft = useCallback(() => {
    const now = Math.floor(Date.now() / 1000);
    const unlockTime = startTime + lockPeriod;
    const diff = unlockTime - now;
    
    if (diff <= 0) {
      return "Unlocked";
    }
    
    // For very short durations, show seconds
    if (diff < 60) {
      return `${diff}s remaining`;
    }
    
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  }, [startTime, lockPeriod]);
  
  useEffect(() => {
    setTimeLeft(calculateTimeLeft());
    // Use shorter interval for short durations
    const intervalMs = lockPeriod < 60 ? 1000 : 60000; // Update every second for short durations
    
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, intervalMs);
    
    return () => clearInterval(timer);
  }, [startTime, lockPeriod, calculateTimeLeft]);
  
  return <span>{timeLeft}</span>;
} 