"use client";

import React, { useState, useEffect } from 'react';
import { ArrowUpRight, ChevronDown, Clock, Wallet, TrendingUp, Lock, Zap, AlertCircle, Bot, Play, Square } from "lucide-react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { BN } from '@project-serum/anchor';
import { PublicKey } from '@solana/web3.js';
import { useAuth } from "@crossmint/client-sdk-react-ui";
import CrossmintLoginButton from '@/components/CrossmintLoginButton';
import CrossmintProviders from '@/providers/CrossmintProviders';
import { useOnboardingStore } from '@/store/useOnboardingStore';
import { useRouter } from 'next/navigation';

// Import our hooks
import { useStaking } from '@/hooks/useStaking';
import { useStake } from '@/hooks/useStake';
import { useUnstake } from '@/hooks/useUnstake';
import { useHarvest } from '@/hooks/useHarvest';
import { useCheckStake } from '@/hooks/useCheckStake';
import { useTotalLiquidity } from '@/hooks/useTotalLiquidity';

// Import from constants
import { YIELD_TIERS, poolState, usdtTrxWhirlpool } from '@/constants/constants';
import SmartWalletBalances from "@/components/SmartWalletBalances";

export const dynamic = 'force-dynamic';

// Helper function to format unlock date
const formatUnlockDate = (startTime: bigint, lockPeriod: bigint) => {
  const unlockTimeSeconds = Number(startTime) + Number(lockPeriod);
  return new Date(unlockTimeSeconds * 1000).toLocaleDateString();
};

// Helper function to calculate estimated rewards
const calculateEstimatedRewards = (amount: number, apy: number, durationSeconds: number) => {
  const dailyRate = apy / 365 / 100;
  const durationDays = durationSeconds / (24 * 60 * 60);
  return amount * dailyRate * durationDays;
};

function YieldPageContent() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [selectedPool, setSelectedPool] = useState("defai-staking");
  const [selectedTimeframe, setSelectedTimeframe] = useState("30");
  const { user: crossmintUser, status: crossmintStatus } = useAuth();
  
  // Staking state
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [amount, setAmount] = useState('');
  const [stakingPeriod, setStakingPeriod] = useState('2592000'); // 30 days in seconds
  
  // Use our imported hooks
  const staking = useStaking();
  const { stake } = useStake();
  const { unstake, isLoading: unstakeLoading, error: unstakeError } = useUnstake();
  const { harvest, isLoading: harvestLoading } = useHarvest();
  const checkStakeHook = useCheckStake();
  const { isStaked, stakedPosition, isLoading: checkStakeLoading } = checkStakeHook;
  const { totalLiquidity, loading: liquidityLoading } = useTotalLiquidity(poolState);
  
  // AI Agent state
  const [agentGoal, setAgentGoal] = useState("");
  const [allowedFunctions, setAllowedFunctions] = useState<Record<string, boolean>>({
    stake: true,
    unstake: true,
    harvest: true,
    checkStake: true,
  });
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [agentLog, setAgentLog] = useState<string[]>([]);

  // Check stake on mount
  useEffect(() => {
    if (publicKey && connected && checkStakeHook && typeof checkStakeHook.checkStakingStatus === 'function') {
      checkStakeHook.checkStakingStatus();
    }
  }, [publicKey, connected, checkStakeHook]);

  const toggleFunction = (func: string) => {
    setAllowedFunctions((prev) => ({ ...prev, [func]: !prev[func] }));
  };

  const runAgent = () => {
    if (!agentGoal.trim()) return;
    setIsAgentRunning(true);
    setAgentLog((log) => [...log, `▶️ Agent started with goal: "${agentGoal}"`]);
    setTimeout(() => {
      setAgentLog((log) => [...log, "✅ Agent finished execution (simulation)"]);
      setIsAgentRunning(false);
    }, 3000);
  };

  const stopAgent = () => {
    setIsAgentRunning(false);
    setAgentLog((log) => [...log, "⏹️ Agent stopped by user"]);
  };

  // Mock data for demonstration
  const portfolioData = {
    totalStaked: 125000,
    totalRewards: 12500,
    avgAPY: 8.4,
    stakingPositions: 3
  };

  const poolsData = [
    {
      id: "defai-staking",
      name: "DeFAI Staking",
      description: "Stake DEFAI and earn rewards",
      token: "DEFAI",
      apy: "12.5%",
      totalStaked: "$5.7M",
      lockPeriod: "Flexible",
      minStake: "1,000 DEFAI",
      featured: true,
      color: "#3366FF"
    },
    {
      id: "air-staking",
      name: "AIR Token Staking",
      description: "Stake AIR tokens for yield",
      token: "AIR",
      apy: "8.2%",
      totalStaked: "$3.2M",
      lockPeriod: "30 Days",
      minStake: "500 AIR",
      featured: false,
      color: "#3366FF"
    },
    {
      id: "lp-staking",
      name: "LP Token Staking",
      description: "Provide liquidity and earn",
      token: "LP",
      apy: "15.7%",
      totalStaked: "$1.8M",
      lockPeriod: "90 Days",
      minStake: "100 LP",
      featured: false,
      color: "#3366FF"
    }
  ];

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Yield Farming</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto flex items-center gap-4 px-4">
          {crossmintStatus === 'connected' ? (
            <SmartWalletBalances />
          ) : (
            <CrossmintLoginButton />
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Portfolio Overview */}
            <Card className="col-span-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Staking Overview</CardTitle>
                  <CardDescription>Your DeFAI staking performance</CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-2">
                      Last {selectedTimeframe} Days
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setSelectedTimeframe("7")}>Last 7 Days</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedTimeframe("30")}>Last 30 Days</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedTimeframe("90")}>Last 90 Days</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSelectedTimeframe("All")}>All Time</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-4">
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium text-muted-foreground">Total Staked</div>
                    <div className="text-3xl font-bold">${portfolioData.totalStaked.toLocaleString()}</div>
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <ArrowUpRight className="h-4 w-4" />
                      <span>+5.2%</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium text-muted-foreground">Total Rewards</div>
                    <div className="text-3xl font-bold">${portfolioData.totalRewards.toLocaleString()}</div>
                    <div className="flex items-center gap-1 text-sm text-green-600">
                      <ArrowUpRight className="h-4 w-4" />
                      <span>+12.7%</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium text-muted-foreground">Average APY</div>
                    <div className="text-3xl font-bold">{portfolioData.avgAPY}%</div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <TrendingUp className="h-4 w-4" />
                      <span>Competitive</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="text-sm font-medium text-muted-foreground">Active Positions</div>
                    <div className="text-3xl font-bold">{portfolioData.stakingPositions}</div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Updated 5m ago</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Staking Pools */}
            <Card className="col-span-full">
              <CardHeader>
                <CardTitle>Staking Pools</CardTitle>
                <CardDescription>Available pools for staking your assets</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="all">
                  <TabsList className="mb-4">
                    <TabsTrigger value="all">All Pools</TabsTrigger>
                    <TabsTrigger value="staked">My Stakes</TabsTrigger>
                    <TabsTrigger value="featured">Featured</TabsTrigger>
                  </TabsList>
                  <TabsContent value="all" className="space-y-4">
                    {poolsData.map((pool) => (
                      <div key={pool.id} className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3366FF]/10">
                            <span className="text-lg font-bold text-[#3366FF]">{pool.token}</span>
                          </div>
                          <div>
                            <h3 className="font-semibold">{pool.name}</h3>
                            <p className="text-sm text-muted-foreground">{pool.description}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 md:flex-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">APY</span>
                            <span className="font-semibold text-[#3366FF]">{pool.apy}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Total Staked</span>
                            <span className="font-semibold">{pool.totalStaked}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Lock Period</span>
                            <span className="font-semibold">{pool.lockPeriod}</span>
                          </div>
                          <Button className="ml-auto bg-[#3366FF] hover:bg-[#2952cc]">Stake Now</Button>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                  <TabsContent value="staked" className="space-y-4">
                    {/* My Staked Positions */}
                    {isStaked && stakedPosition ? (
                      <div className="flex flex-col gap-4 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3366FF]/10">
                            <span className="text-lg font-bold text-[#3366FF]">DEFAI</span>
                          </div>
                          <div>
                            <h3 className="font-semibold">DeFAI Staking</h3>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-[#3366FF]">Active</Badge>
                              <p className="text-sm text-muted-foreground">Staked: {Number(stakedPosition.liquidity || 0).toLocaleString()} DEFAI</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 md:flex-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Rewards</span>
                            <span className="font-semibold text-[#3366FF]">{Number(stakedPosition.rewards || 0).toFixed(4)} DEFAI</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm text-muted-foreground">Next Reward</span>
                            <span className="font-semibold">12h 34m</span>
                          </div>
                          <Button 
                            variant="outline" 
                            className="ml-auto"
                            onClick={async () => {
                              setIsClaiming(true);
                              try {
                                await harvest();
                              } finally {
                                setIsClaiming(false);
                              }
                            }}
                            disabled={isClaiming || harvestLoading}
                          >
                            {isClaiming ? "Claiming..." : "Claim Rewards"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No active staking positions
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="featured" className="space-y-4">
                    {/* Featured Pool */}
                    <div className="flex flex-col gap-4 rounded-lg border border-[#3366FF] bg-[#3366FF]/5 p-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#3366FF]/20">
                          <span className="text-lg font-bold text-[#3366FF]">DEFAI</span>
                        </div>
                        <div>
                          <h3 className="font-semibold">DeFAI Governance Staking</h3>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-[#3366FF]">Featured</Badge>
                            <Badge variant="outline">2x Rewards</Badge>
                            <p className="text-sm text-muted-foreground">Limited time offer</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 md:flex-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm text-muted-foreground">APY</span>
                          <span className="font-semibold text-[#3366FF]">12.5%</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm text-muted-foreground">Total Staked</span>
                          <span className="font-semibold">$5.7M</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm text-muted-foreground">Lock Period</span>
                          <span className="font-semibold">Flexible</span>
                        </div>
                        <Button className="ml-auto bg-[#3366FF] hover:bg-[#2952cc]">Stake Now</Button>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* AI Agent Control Panel */}
            <Card className="col-span-full lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-[#3366FF]" />
                  AI Yield Agent
                </CardTitle>
                <CardDescription>
                  Delegate yield farming tasks to your AI agent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Agent Goal</label>
                  <textarea
                    value={agentGoal}
                    onChange={(e) => setAgentGoal(e.target.value)}
                    rows={3}
                    className="w-full rounded-md border border-input bg-background p-3 text-sm"
                    placeholder="E.g. Maximize yield by automatically compounding rewards every 24 hours"
                  />
                </div>

                <div>
                  <h4 className="text-sm font-medium mb-3">Allowed Functions</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.keys(allowedFunctions).map((fnKey) => (
                      <label key={fnKey} className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={allowedFunctions[fnKey]}
                          onChange={() => toggleFunction(fnKey)}
                          className="rounded border-gray-300 text-[#3366FF] focus:ring-[#3366FF]"
                        />
                        <span className="text-sm capitalize">{fnKey}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button 
                    onClick={runAgent} 
                    disabled={isAgentRunning || !agentGoal.trim()}
                    className="flex-1 bg-[#3366FF] hover:bg-[#2952cc]"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {isAgentRunning ? "Running..." : "Run Agent"}
                  </Button>
                  <Button 
                    onClick={stopAgent} 
                    disabled={!isAgentRunning}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop Agent
                  </Button>
                </div>

                {agentLog.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Agent Activity Log</h4>
                    <div className="h-32 overflow-auto border rounded-md p-3 bg-muted/50 text-xs space-y-1 font-mono">
                      {agentLog.map((msg, idx) => (
                        <div key={idx} className="text-muted-foreground">{msg}</div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pool Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Pool Statistics</CardTitle>
                <CardDescription>Current pool performance metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Total Value Locked</span>
                      <span className="text-sm font-bold">$10.7M</span>
                    </div>
                    <Progress value={75} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Pool Utilization</span>
                      <span className="text-sm font-bold">82%</span>
                    </div>
                    <Progress value={82} className="h-2" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Rewards Distributed</span>
                      <span className="text-sm font-bold">1.2M DEFAI</span>
                    </div>
                    <Progress value={60} className="h-2" />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  View Detailed Analytics
                </Button>
              </CardFooter>
            </Card>
          </div>
      </div>
    </>
  );
}

export default function YieldPage() {
  return (
    <CrossmintProviders>
      <SidebarInset>
        <YieldPageContent />
      </SidebarInset>
    </CrossmintProviders>
  );
}