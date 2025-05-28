"use client";
import { useAgentSetupStore } from '@/stores/agentSetupStore';
import { Slider } from "@/components/ui/slider"; 
import { useState, useEffect } from 'react';

export default function EarningsShareStep() {
  const { sharePercent, setSharePercent, name } = useAgentSetupStore();
  const [localShare, setLocalShare] = useState(sharePercent);

  useEffect(() => {
    setLocalShare(sharePercent);
  }, [sharePercent]);

  const handleSliderChange = (value: number[]) => {
    setLocalShare(value[0]);
    setSharePercent(value[0]);
  };

  const getCaption = (percent: number) => {
    if (percent <= 10) return "Fair, but you're the captain of this ship.";
    if (percent <= 30) return "A balanced partnership, fostering mutual growth.";
    if (percent <= 50) return `A generous pact! ${name || 'Your agent'} will be super-charged by your commitment!`;
    return "";
  };
  
  const agentDisplayName = name || "your AI agent";

  return (
    <div className="py-4 space-y-6">
      <div>
        <label htmlFor="earningsShare" className="block text-sm font-medium text-slate-300 text-center">
          How much of your future DEFAI earnings from joint activities will you share with {agentDisplayName}?
        </label>
        <p className="text-center text-3xl font-bold text-sky-400 my-3">{localShare}%</p>
        <Slider
          id="earningsShare"
          min={0}
          max={50}
          step={1}
          value={[localShare]}
          onValueChange={handleSliderChange}
          className="w-full [&>span:first-child]:h-3 [&>span:first-child>span]:h-3 [&>span:first-child>span]:bg-sky-500 [&>span:first-child]:bg-slate-700"
        />
         <div className="flex justify-between text-xs text-slate-500 mt-1.5 px-1">
          <span>0% (All Yours)</span>
          <span>25%</span>
          <span>50% (Max Share)</span>
        </div>
      </div>
      <p className="text-center text-xs text-sky-300/90 min-h-[30px]">
        {getCaption(localShare)}
      </p>
      <p className="text-xs text-slate-500 text-center pt-2">
        This determines how rewards are split between you and {agentDisplayName}. A higher share can motivate advanced agent strategies.
      </p>
    </div>
  );
} 