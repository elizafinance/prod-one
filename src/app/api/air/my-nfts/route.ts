import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey as umiPublicKey, Umi } from '@metaplex-foundation/umi';
import { fetchAllDigitalAssetByOwner, DigitalAsset } from '@metaplex-foundation/mpl-token-metadata';
import { AIR_NFT_TIERS } from '@/config/airNft.config'; // Used to map tier data

const airNftSchema = z.object({
  tokenId: z.string(), // The mint address of the NFT instance
  tier: z.number(),    // e.g., 1, 2, 3
  name: z.string(),    // e.g., "Bronze AIR NFT", "Gold AIR NFT"
  bonusPct: z.number(),
  imageUrl: z.string().url().optional(), // Link to the NFT image
  // Add other relevant metadata properties from your NFT standard
});

const myNftsResponseSchema = z.array(airNftSchema);

export type AirNft = z.infer<typeof airNftSchema>;

// Assume this is your deployed Hybrid Collection Mint PDA
const HYBRID_COLLECTION_MINT_PDA_STR = process.env.NEXT_PUBLIC_HYBRID_COLLECTION_MINT_PDA || 'YOUR_COLLECTION_MINT_PDA_ADDRESS_HERE';
const SOLANA_RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT || 'https://api.devnet.solana.com';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !session.user.walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userWalletAddress = session.user.walletAddress;

  if (HYBRID_COLLECTION_MINT_PDA_STR === 'YOUR_COLLECTION_MINT_PDA_ADDRESS_HERE') {
    console.warn('[API /api/air/my-nfts] HYBRID_COLLECTION_MINT_PDA_STR is not set. Returning simulated data.');
    // Fallback to simulated data if not configured
    const simulatedNftsForUnconfigured: AirNft[] = [
      { tokenId: `sim_placeholder_1`, tier: 1, name: 'Bronze AIR NFT (Unconfigured)', bonusPct: 0.10, imageUrl: 'https://example.com/nft/bronze.png' },
    ];
    return NextResponse.json(myNftsResponseSchema.parse(simulatedNftsForUnconfigured));
  }

  try {
    console.log(`[API /api/air/my-nfts] Fetching NFTs for ${userWalletAddress} on ${SOLANA_RPC_ENDPOINT}`);
    const umi: Umi = createUmi(SOLANA_RPC_ENDPOINT);
    const owner = umiPublicKey(userWalletAddress);
    const collectionMint = umiPublicKey(HYBRID_COLLECTION_MINT_PDA_STR);

    // Fetch all assets owned by the user.
    // This can return a lot of data if the user has many NFTs/assets.
    // For MPL-Hybrid, the NFTs are regular Metaplex NFTs that are part of the Hybrid collection.
    const assets = await fetchAllDigitalAssetByOwner(umi, owner);

    const airNfts: AirNft[] = [];
    console.log(`[API /api/air/my-nfts] Found ${assets.length} total assets for ${userWalletAddress}. Filtering for collection ${HYBRID_COLLECTION_MINT_PDA_STR}...`);

    for (const asset of assets) {
      // Filter by collection
      // How collection info is stored can vary. Common checks:
      // 1. Direct `asset.metadata.collection` (if it exists and is structured with key & verified flag)
      // 2. `asset.grouping` if part of a Metaplex Certified Collection (MCC)
      // 3. Sometimes it might be under `asset.mint.collection` (less common for DAS API like fetchAllDigitalAssetByOwner)
      let isCollectionMatch = false;
      let collectionKeyOnAsset: string | undefined = undefined;

      // Check asset.metadata.collection (this is a common pattern for older token-metadata, might differ in DigitalAsset)
      if (asset.metadata && (asset.metadata as any).collection) { // Use any for guards if type is too strict or unknown
        const metaCollection = (asset.metadata as any).collection;
        if (metaCollection.key && metaCollection.verified) {
          collectionKeyOnAsset = metaCollection.key.toString();
          if (collectionKeyOnAsset === collectionMint.toString() && metaCollection.verified) {
            isCollectionMatch = true;
          }
        }
      }

      // If not found, try checking for a grouping structure (often used by `DigitalAsset` from DAS)
      // This path needs verification against the actual DigitalAsset structure from your mpl-token-metadata version.
      if (!isCollectionMatch && (asset as any).grouping) {
        const grouping = (asset as any).grouping;
        if (grouping.group_key === 'collection' && grouping.group_value === collectionMint.toString()) {
          // Verification might be implicit or need another check depending on how DAS structures this.
          // For this example, if group_key is collection and group_value matches, assume it is part of the intended collection.
          // You might need to confirm if there is a separate verification flag in this structure.
          isCollectionMatch = true;
          collectionKeyOnAsset = grouping.group_value;
        }
      }

      if (isCollectionMatch) {
        const tierInfo = AIR_NFT_TIERS.find(t => asset.metadata.name.includes(t.name));
        let imageUrl = undefined;
        try {
          if (asset.metadata.uri) {
            const metadataJsonResponse = await fetch(asset.metadata.uri);
            if(metadataJsonResponse.ok){
              const offChainMetadata = await metadataJsonResponse.json();
              imageUrl = offChainMetadata.image;
            }
          }
        } catch (e) { console.warn(`Failed to fetch or parse metadata URI ${asset.metadata.uri}:`, e); }

        airNfts.push({
          tokenId: asset.publicKey.toString(),
          name: asset.metadata.name,
          tier: tierInfo ? tierInfo.tier : 0,
          bonusPct: tierInfo ? tierInfo.bonusPct : 0,
          imageUrl: imageUrl,
        });
      } else if (assets.length < 10) { // Log details only for a few assets to avoid spamming for large wallets
        // console.log(`Asset ${asset.publicKey.toString()} (${asset.metadata.name}) did not match collection. CollectionKeyOnAsset: ${collectionKeyOnAsset}, Expected: ${collectionMint.toString()}`);
      }
    }

    console.log(`[API /api/air/my-nfts] Found ${airNfts.length} AIR NFTs for ${userWalletAddress}.`);

    if (airNfts.length === 0 && assets.length > 0) {
      console.log('[API /api/air/my-nfts] User has assets, but none match the AIR NFT collection criteria or metadata mapping failed.');
      // You might want to log more details about the assets found to debug collection filtering
      // assets.forEach(a => console.log(`Asset: ${a.publicKey}, Name: ${a.metadata.name}, Collection: ${a.collectionDetails?.__kind === 'SizedCollection' ? a.collectionDetails.key.toString() : 'N/A'}`));
    }

    const validatedNfts = myNftsResponseSchema.parse(airNfts);
    return NextResponse.json(validatedNfts);

  } catch (error) {
    console.error('[API /api/air/my-nfts] Error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Data validation error processing NFTs', details: error.issues }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to fetch AIR NFTs' }, { status: 500 });
  }
} 