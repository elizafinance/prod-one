"use client";

import MyAirPanel from '@/components/myAir/MyAirPanel';
import { DashboardHeader } from '@/components/dashboard-header';

export default function MyAirPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardHeader heading="My AIR" text="Check your AIR points, mint AIR NFTs, and view your collection." />
      <MyAirPanel />
    </div>
  );
} 