"use client";
import { FC, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const Chart = dynamic(
  () => import('./PriceAreaChart'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-gray-400 animate-pulse">Loading chart...</div>
      </div>
    ),
  }
);

interface PriceChartProps {
  tokenAddress: string;
}

interface ChartDataItem {
  unixTime: number;
  value: number;
  time: string;
}

interface CachedData {
  data: ChartDataItem[];
  timestamp: number;
}

const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export const PriceChart: FC<PriceChartProps> = ({ tokenAddress }) => {
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        // Check cache first
        const cachedData = localStorage.getItem(`price_history_${tokenAddress}`);
        if (cachedData) {
          const { data, timestamp }: CachedData = JSON.parse(cachedData);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setChartData(data);
            setLoading(false);
            return;
          }
        }

        const now = Math.floor(Date.now() / 1000);
        const oneWeek = 7 * 24 * 60 * 60;
        const from = now - oneWeek;

        const options = {
          method: 'GET',
          headers: {
            accept: 'application/json',
            'x-chain': 'solana',
            'X-API-KEY': process.env.NEXT_PUBLIC_BIRDEYE_API_KEY || ''
          }
        };

        const response = await fetch(
          `https://public-api.birdeye.so/defi/history_price?address=${tokenAddress}&address_type=token&type=15m&time_from=${from}&time_to=${now}`,
          options
        );

        if (!response.ok) throw new Error('Failed to fetch chart data');

        const result = await response.json();
        if (result.success && result.data?.items) {
          const formattedData = result.data.items.map((item: ChartDataItem) => ({
            ...item,
            time: new Date(item.unixTime * 1000).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            }),
          }));

          // Cache the data
          localStorage.setItem(`price_history_${tokenAddress}`, JSON.stringify({
            data: formattedData,
            timestamp: Date.now()
          }));

          setChartData(formattedData);
        }
      } catch (error) {
        console.error('Error fetching chart data:', error);
        // If fetch fails, try to use cached data even if expired
        const cachedData = localStorage.getItem(`price_history_${tokenAddress}`);
        if (cachedData) {
          const { data }: CachedData = JSON.parse(cachedData);
          setChartData(data);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
    // Refresh every 2.5 minutes for live data
    const interval = setInterval(fetchChartData, 2.5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [tokenAddress]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-gray-400 animate-pulse">Loading chart data...</div>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-gray-400">No price data available</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <Chart data={chartData} />
    </div>
  );
}; 