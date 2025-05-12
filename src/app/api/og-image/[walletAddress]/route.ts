import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(
  request: Request,
  { params }: { params: { walletAddress: string } }
) {
  const walletAddress = params.walletAddress;

  if (!walletAddress) {
    return new Response('Wallet address parameter is required', { status: 400 });
  }

  // Fetch user data for the OG image
  let userData = null;
  try {
    const { db } = await connectToDatabase();
    userData = await db.collection('users').findOne({ walletAddress });
  } catch (err) {
    console.error("Error fetching user data for OG image:", err);
  }

  // Prepare display values
  const displayWallet = walletAddress.substring(0, 6) + '...' + walletAddress.substring(walletAddress.length - 4);
  const displayName = userData?.xUsername ? `@${userData.xUsername}` : displayWallet;
  const displayPoints = userData?.points?.toLocaleString() || '0';
  const displayTier = userData?.highestAirdropTierLabel || 'No Tier';

  // Create a simple SVG for the OG image
  const svg = `
  <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#4F46E5;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#2563EB;stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#grad)"/>
    <rect x="100" y="100" width="1000" height="430" rx="24" fill="rgba(0,0,0,0.5)"/>
    
    <text x="600" y="180" font-family="sans-serif" font-size="60" font-weight="bold" fill="white" text-anchor="middle">
      DeFAI Rewards
    </text>
    
    <text x="600" y="250" font-family="sans-serif" font-size="48" font-weight="bold" fill="white" text-anchor="middle">
      ${displayName}
    </text>
    
    <g transform="translate(350, 350)">
      <text x="0" y="0" font-family="sans-serif" font-size="28" fill="rgba(255,255,255,0.8)" text-anchor="middle">
        Points
      </text>
      <text x="0" y="50" font-family="sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">
        ${displayPoints}
      </text>
    </g>
    
    <g transform="translate(850, 350)">
      <text x="0" y="0" font-family="sans-serif" font-size="28" fill="rgba(255,255,255,0.8)" text-anchor="middle">
        Tier
      </text>
      <text x="0" y="50" font-family="sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">
        ${displayTier}
      </text>
    </g>
    
    <text x="600" y="600" font-family="sans-serif" font-size="20" fill="rgba(255,255,255,0.8)" text-anchor="middle">
      claim.defairewards.net
    </text>
  </svg>
  `;

  return new Response(svg, { 
    headers: { 'Content-Type': 'image/svg+xml' } 
  });
} 