"use client";
import { FC, useEffect, useState } from 'react';
import { Agent } from './AgentSelector';
import { PublicKey } from "@solana/web3.js";
import { PriceChart } from './PriceChart';
import { formatLargeNumber } from "@/lib/utils";

interface AgentIntelligenceProps {
  agent: Agent;
}

interface TokenData {
  v24hUSD: number;
  holder: number;
  price: number;
  priceChange24hPercent: number;
}

// AIORA token mint address
const AIORA_TOKEN_MINT = new PublicKey("3Vh9jur61nKnKzf6HXvVpEsYaLrrSEDpSgfMSS3Bpump");

export const AgentIntelligence: FC<AgentIntelligenceProps> = ({ agent }) => {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTokenData = async () => {
      const tokenAddress = agent.tokenAddress || AIORA_TOKEN_MINT.toString();

      try {
        const options = {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'x-chain': 'solana',
            'X-API-KEY': process.env.NEXT_PUBLIC_BIRDEYE_API_KEY || ''
          }
        };

        const response = await fetch(
          `https://public-api.birdeye.so/defi/token_overview?address=${tokenAddress}`,
          options
        );

        if (!response.ok) throw new Error('Failed to fetch token data');

        const result = await response.json();
        if (result.success && result.data) {
          setTokenData({
            v24hUSD: result.data.v24hUSD,
            holder: result.data.holder,
            price: result.data.price,
            priceChange24hPercent: result.data.priceChange24hPercent
          });
        }
      } catch (error) {
        console.error('Error fetching token data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTokenData();
    // Refresh every 2.5 minutes
    const interval = setInterval(fetchTokenData, 2.5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [agent.tokenAddress]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Crypto Intelligence Panel */}
      <div className="bg-navy-900/50 border border-blue-500/20 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-blue-400">Crypto Intelligence</h2>
        <div className="space-y-4">
          <div className="bg-black/40 rounded-lg p-6 h-48">
            <div className="text-sm text-gray-400 mb-2">Price Action</div>
            <PriceChart tokenAddress={agent.tokenAddress || AIORA_TOKEN_MINT.toString()} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-4">
              <div className="text-sm text-gray-400">24h Volume</div>
              <div className={`text-xl font-bold ${loading ? 'animate-pulse text-gray-600' : ''}`}>
                ${loading ? '0.00' : formatLargeNumber(tokenData?.v24hUSD || 0)}
              </div>
            </div>
            <div className="bg-black/40 rounded-lg p-4">
              <div className="text-sm text-gray-400">Holders</div>
              <div className={`text-xl font-bold ${loading ? 'animate-pulse text-gray-600' : ''}`}>
                {loading ? '0' : formatLargeNumber(tokenData?.holder || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Intelligence Panel */}
      <div className="bg-purple-900/50 border border-purple-500/20 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-purple-400">Social Intelligence</h2>
        <div className="space-y-4">
          <div className="bg-black/40 rounded-lg p-4 h-48">
            <div className="text-sm text-gray-400 mb-2">Sentiment Analysis</div>
            {/* Add sentiment chart here */}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-4">
              <div className="text-sm text-gray-400">Mentions</div>
              <div className="text-xl font-bold">95.4k</div>
            </div>
            <div className="bg-black/40 rounded-lg p-4">
              <div className="text-sm text-gray-400">Sentiment</div>
              <div className="text-xl font-bold text-green-400">+45%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Threat Intelligence Panel */}
      <div className="bg-red-900/50 border border-red-500/20 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 text-red-400">Threat Intelligence</h2>
        <div className="space-y-4">
          <div className="bg-black/40 rounded-lg p-4 h-48">
            <div className="text-sm text-gray-400 mb-2">Activity Monitor</div>
            {/* Add threat visualization here */}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black/40 rounded-lg p-4">
              <div className="text-sm text-gray-400">Alerts</div>
              <div className="text-xl font-bold text-red-400">24</div>
            </div>
            <div className="bg-black/40 rounded-lg p-4">
              <div className="text-sm text-gray-400">Risk Level</div>
              <div className="text-xl font-bold">Medium</div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Table */}
      <div className="lg:col-span-3 bg-gray-900/50 border border-gray-500/20 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Recent Activity</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left p-2">Time</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Details</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {/* Add table rows here */}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}; 