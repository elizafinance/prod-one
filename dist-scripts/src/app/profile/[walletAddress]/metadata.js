import { connectToDatabase } from '@/lib/mongodb';
// SERVER-SIDE EXPORT: generateMetadata
export async function generateMetadata({ params }, parent) {
    const walletAddress = params.walletAddress;
    const siteName = "DeFAI Rewards";
    const defaultOgImage = `https://claim.defairewards.net/default-og-image.png`; // Ensure this exists
    if (!walletAddress) {
        return {
            title: `User Profile | ${siteName}`,
            openGraph: { images: [defaultOgImage] },
        };
    }
    // Fetch user data to create a more personalized OG image and metadata
    let userData = null;
    try {
        const { db } = await connectToDatabase();
        userData = await db.collection('users').findOne({ walletAddress });
    }
    catch (err) {
        console.error("Error fetching user data for metadata:", err);
    }
    // Create personalized title and description
    const userName = userData?.xUsername ? `@${userData.xUsername}` : `${walletAddress.substring(0, 6)}...`;
    const pointsText = userData?.points ? `${userData.points.toLocaleString()} points` : '';
    const tierText = userData?.highestAirdropTierLabel ? ` | ${userData.highestAirdropTierLabel} Tier` : '';
    const title = userData
        ? `${userName} | ${pointsText}${tierText} | ${siteName}`
        : `Profile: ${walletAddress.substring(0, 6)}... | ${siteName}`;
    const description = userData
        ? `Check out ${userName}'s achievements on ${siteName}! ${pointsText}${tierText}`
        : `Check out the achievements of this user on ${siteName}!`;
    // Using the simplified OG image API for now
    const ogImageUrl = `https://claim.defairewards.net/api/og-image/${walletAddress}`;
    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `DeFAI Rewards Profile for ${userName}` }],
            type: 'profile',
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImageUrl],
            creator: userData?.xUsername ? `@${userData.xUsername}` : undefined,
        },
    };
}
