"use client";
import { FC, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartDataItem {
  unixTime: number;
  value: number;
  time: string;
}

interface PriceAreaChartProps {
  data: ChartDataItem[];
}

const PriceAreaChart: FC<PriceAreaChartProps> = ({ data }) => {
  const formatPrice = (value: number) => {
    if (value >= 1) return `$${value.toFixed(2)}`;
    return `$${value.toFixed(6)}`;
  };

  const isPositive = data.length >= 2 && data[data.length - 1].value > data[0].value;
  
  const chartColor = isPositive ? '#22c55e' : '#ef4444';

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 10, right: 35, left: 10, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={chartColor} stopOpacity={0.8}/>
            <stop offset="95%" stopColor={chartColor} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tick={{ fill: '#9CA3AF' }}
          tickLine={{ stroke: '#4B5563' }}
          minTickGap={40}
        />
        <YAxis
          tick={{ fill: '#9CA3AF' }}
          tickLine={{ stroke: '#4B5563' }}
          domain={['dataMin', 'dataMax']}
          tickFormatter={formatPrice}
          width={75}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            border: '1px solid rgba(75, 85, 99, 0.4)',
            borderRadius: '4px',
          }}
          labelStyle={{ color: '#9CA3AF' }}
          formatter={(value: number) => [formatPrice(value), 'Price']}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={chartColor}
          fillOpacity={1}
          fill="url(#colorPrice)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default PriceAreaChart;
