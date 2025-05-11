import { NextResponse } from 'next/server';
import airdropData from '@/data/airdropData.json';

interface AirdropEntry {
  Account: string;
  "Token Account": string;
  Quantity: number | string; // Keep as string if it might have commas initially from CSV, or number if pre-processed
  AIRDROP: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address query parameter is required' }, { status: 400 });
  }

  const typedAirdropData = airdropData as AirdropEntry[]; // Type assertion

  const entry = typedAirdropData.find(item => item.Account === address.trim());

  if (entry) {
    return NextResponse.json({ AIRDROP: entry.AIRDROP });
  } else {
    return NextResponse.json({ error: "Sorry You Don't Qualify For The Airdrop." }, { status: 404 });
  }
} 