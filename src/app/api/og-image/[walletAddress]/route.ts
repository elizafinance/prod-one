import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { walletAddress: string } }
) {
  const walletAddress = params.walletAddress;

  if (!walletAddress) {
    return new Response('Wallet address parameter is required', { status: 400 });
  }

  // Return a very simple, valid SVG to ensure this API route builds.
  // The complex satori logic will be re-addressed later.
  const simpleSvg = 
`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#1A202C"/>
  <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="70" fill="white">
    OG Image for ${walletAddress.substring(0,6)}...
  </text>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="40" fill="#A78BFA">
    DeFAI Rewards Profile
  </text>
</svg>`;

  return new Response(simpleSvg, { 
    headers: { 'Content-Type': 'image/svg+xml' } 
  });
} 