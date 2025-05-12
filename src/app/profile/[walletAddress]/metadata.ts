// SERVER-SIDE IMPORTS (ONLY for generateMetadata)
import type { Metadata, ResolvingMetadata } from 'next';

// SERVER-SIDE EXPORT: generateMetadata
export async function generateMetadata(
  { params }: { params: { walletAddress: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const walletAddress = params.walletAddress;
  const siteName = "DeFAI Rewards"; 
  const defaultOgImage = `https://claim.defairewards.net/default-og-image.png`; // Ensure this exists

  if (!walletAddress) {
    return {
      title: `User Profile | ${siteName}`,
      openGraph: { images: [defaultOgImage] },
    };
  }
  // Using the simplified OG image API for now
  const ogImageUrl = `https://claim.defairewards.net/api/og-image/${walletAddress}`;
 
  return {
    title: `Profile: ${walletAddress.substring(0,6)}... | ${siteName}`,
    description: `Check out the achievements of this user on ${siteName}!`,
    openGraph: {
      title: `User Profile | ${siteName}`,
      description: `Achievements of ${walletAddress.substring(0,6)}... on ${siteName}.`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `DeFAI Rewards Profile for ${walletAddress}` }],
      type: 'profile',
    },
    twitter: {
      card: 'summary_large_image',
      title: `User Profile | ${siteName}`,
      description: `Achievements of ${walletAddress.substring(0,6)}... on ${siteName}.`,
      images: [ogImageUrl],
    },
  };
} 