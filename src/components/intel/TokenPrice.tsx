"use client";
import { FC, useEffect, useState } from 'react';

interface TokenPriceProps {
  tokenAddress: string;
}

interface TokenOverview {
  price: number;
  priceChange24hPercent: number;
  priceChange1hPercent: number;
  symbol: string;
  timestamp: number;
}

const CACHE_DURATION = 2.5 * 60 * 1000; // 2.5 minutes in milliseconds

export const TokenPrice: FC<TokenPriceProps> = ({ tokenAddress }) => {
  const [tokenData, setTokenData] = useState<TokenOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTokenOverview = async () => {
      // Check cache first
      const cachedData = localStorage.getItem(`token_${tokenAddress}`);
      if (cachedData) {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_DURATION) {
          setTokenData(data);
          setLoading(false);
          return;
        }
      }

      const options = {
        method: 'GET',
        headers: {
          accept: 'application/json',
          'x-chain': 'solana',
          'X-API-KEY': process.env.NEXT_PUBLIC_BIRDEYE_API_KEY || ''
        }
      };

      try {
        const response = await fetch(
          `https://public-api.birdeye.so/defi/token_overview?address=${tokenAddress}`,
          options
        );

        if (!response.ok) {
          throw new Error('Failed to fetch token data');
        }

        const result = await response.json();
        if (result.success && result.data) {
          const newTokenData = {
            price: result.data.price,
            priceChange24hPercent: result.data.priceChange24hPercent,
            priceChange1hPercent: result.data.priceChange1hPercent,
            symbol: result.data.symbol,
            timestamp: Date.now()
          };
          
          // Cache the data
          localStorage.setItem(`token_${tokenAddress}`, JSON.stringify({
            data: newTokenData,
            timestamp: Date.now()
          }));
          
          setTokenData(newTokenData);
        } else {
          throw new Error(result.message || 'Invalid token data');
        }
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch token data');
        setLoading(false);
      }
    };

    if (tokenAddress) {
      fetchTokenOverview();
      // Refresh data every 2.5 minutes
      const interval = setInterval(fetchTokenOverview, CACHE_DURATION);
      return () => clearInterval(interval);
    }
  }, [tokenAddress]);

  if (loading) {
    return (
      <div className="text-xs text-purple-400/50 animate-pulse">
        $0.00
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-400/50">
        Error
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-[10px]">
      <div className="font-medium text-purple-400">
        ${tokenData?.price?.toFixed(4) || '0.0000'}
      </div>
      <span className={`${(tokenData?.priceChange24hPercent || 0) >= 0 ? 'text-green-400/70' : 'text-red-400/70'}`}>
        {(tokenData?.priceChange24hPercent || 0) >= 0 ? '+' : ''}{(tokenData?.priceChange24hPercent || 0).toFixed(1)}%
      </span>
    </div>
  );
}; 