import { NextResponse } from 'next/server';
import airdropDataList from '@/data/airdropData.json';

interface AirdropGsheetEntry {
  Account: string;
  "Token Account": string;
  Quantity: number | string;
  AIRDROP: number;
}

const typedAirdropData = airdropDataList as AirdropGsheetEntry[];

const POINTS_REFERRAL_BONUS_FOR_REFERRER = 20;

const AIRDROP_THRESHOLDS = [
  { amount: 1000000000, points: 10000, tier_action_id: 'airdrop_tier_legend' },    // New: 1B AIR
  { amount: 500000000, points: 5000, tier_action_id: 'airdrop_tier_grandmaster' }, // New: 500M AIR
  { amount: 100000000, points: 1000, tier_action_id: 'airdrop_tier_master' },     // New: 100M AIR
  { amount: 10000000, points: 500, tier_action_id: 'airdrop_tier_diamond' },      // New: 10M AIR
  { amount: 1000000, points: 300, tier_action_id: 'airdrop_tier_gold' },
  { amount: 100000, points: 150, tier_action_id: 'airdrop_tier_silver' },
  { amount: 10000, points: 50, tier_action_id: 'airdrop_tier_bronze' },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('address');

  if (!walletAddress) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
  }

  const airdropEntry = typedAirdropData.find(item => item.Account === walletAddress.trim());

  if (airdropEntry) {
    return NextResponse.json({ AIRDROP: airdropEntry.AIRDROP });
  } else {
    return NextResponse.json({ error: "Sorry You Don't Qualify For The Airdrop." }, { status: 404 });
  }
  // NOTE: All MongoDB interaction, user creation, point awarding, and referral logic
  // has been moved to the new /api/users/activate-rewards endpoint (or other specific endpoints).
  // This endpoint is now purely for checking the static airdrop list.
} 