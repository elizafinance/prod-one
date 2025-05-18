// scripts/mintTier.ts
import {
  createNft, // Assuming createNft is a valid export, or use createHybridClass if available and correct
  // createHybridClass, // Verify correct export from mpl-hybrid
} from '@metaplex-foundation/mpl-hybrid';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey, Umi, KeypairSigner, generateSigner } from '@metaplex-foundation/umi';
import { signerIdentity, mplToolbox } from '@metaplex-foundation/umi-plugin-mpl-toolbox';
import { Connection, clusterApiUrl, Keypair as Web3Keypair, PublicKey as Web3PublicKey } from '@solana/web3.js';
import { AIR_NFT_TIERS } from '../src/config/airNft.config';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration ---
const SOLANA_CLUSTER_URL = clusterApiUrl('devnet');
const ADMIN_KEYPAIR_PATH = path.join(__dirname, '..', '_keypairs', 'admin-keypair.json'); // Path to your admin/authority keypair

// These MUST be replaced with your actual deployed addresses
const HYBRID_COLLECTION_MINT_PDA = 'YOUR_COLLECTION_MINT_PDA_ADDRESS_HERE'; 
const DEFAI_SPL_TOKEN_MINT = 'YOUR_DEFAI_SPL_TOKEN_MINT_ADDRESS_HERE';

// --- Helper to load Web3.js keypair ---
function loadWeb3Keypair(pathToKeypairFile: string): Web3Keypair {
  if (!fs.existsSync(pathToKeypairFile)) {
    throw new Error(`Keypair file not found at ${pathToKeypairFile}`);
  }
  const secretKeyString = fs.readFileSync(pathToKeypairFile, { encoding: 'utf8' });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Web3Keypair.fromSecretKey(secretKey);
}

async function mintNftTiers() {
  console.log(`Connecting to Solana cluster: ${SOLANA_CLUSTER_URL}`);
  const connection = new Connection(SOLANA_CLUSTER_URL, 'confirmed');
  
  let adminWeb3Keypair: Web3Keypair;
  try {
    adminWeb3Keypair = loadWeb3Keypair(ADMIN_KEYPAIR_PATH);
    console.log(`Loaded admin keypair: ${adminWeb3Keypair.publicKey.toBase58()}`);
  } catch (error) {
    console.error('Failed to load admin keypair:', (error as Error).message);
    console.log('Please ensure a keypair exists at', ADMIN_KEYPAIR_PATH);
    console.log('You can generate one with `solana-keygen new --outfile ../_keypairs/admin-keypair.json`');
    return;
  }

  // Initialize Umi and set up the signer
  const umi: Umi = createUmi(SOLANA_CLUSTER_URL)
    .use(mplToolbox());
  
  // Create a Umi KeypairSigner from the Web3Keypair
  // This requires converting the secret key. Umi's generateSigner().fromSecretKey() expects a 64-byte Uint8Array.
  // Web3Keypair.secretKey is already in the correct format (64-byte private key).
  const umiAdminSigner: KeypairSigner = umi.eddsa.createKeypairFromSecretKey(adminWeb3Keypair.secretKey);
  umi.use(signerIdentity(umiAdminSigner));

  console.log(`Umi instance created and signer set to: ${umi.identity.publicKey.toString()}`);

  if (HYBRID_COLLECTION_MINT_PDA === 'YOUR_COLLECTION_MINT_PDA_ADDRESS_HERE') {
    console.error('Error: HYBRID_COLLECTION_MINT_PDA is not set in scripts/mintTier.ts');
    return;
  }
  if (DEFAI_SPL_TOKEN_MINT === 'YOUR_DEFAI_SPL_TOKEN_MINT_ADDRESS_HERE') {
    console.error('Error: DEFAI_SPL_TOKEN_MINT is not set in scripts/mintTier.ts');
    return;
  }

  const collectionMintPda = publicKey(HYBRID_COLLECTION_MINT_PDA);
  const underlyingSplTokenMint = publicKey(DEFAI_SPL_TOKEN_MINT);

  console.log(`Target Hybrid Collection Mint (PDA): ${collectionMintPda.toString()}`);
  console.log(`Underlying $DEFAI SPL Token Mint: ${underlyingSplTokenMint.toString()}`);

  for (const tier of AIR_NFT_TIERS) {
    console.log(`\nProcessing Tier: ${tier.name} (ID: ${tier.tier})`);

    const underlyingAmountForClass = BigInt(Math.floor(tier.pointsPerNft * (1 + tier.bonusPct)));
    console.log(`  Points per NFT: ${tier.pointsPerNft}`);
    console.log(`  Bonus Pct: ${tier.bonusPct * 100}%`);
    console.log(`  Calculated underlying amount for Hybrid Class (as BigInt): ${underlyingAmountForClass.toString()}`);
    console.log(`  Max Supply for this class: ${tier.cap}`);

    try {
      // This is a conceptual call. `createNft` from mpl-hybrid might have different parameters
      // or you might need `createHybridClass` if that is the correct export.
      // The exact function and parameters depend on the version of mpl-hybrid you are using.
      // This example assumes `createNft` is suitable for creating a class/type within a hybrid collection.
      
      // const mint = generateSigner(umi); // Each NFT class might need its own mint account as a signer if it's a new asset
      
      // console.log(`  Generated mint signer for class ${tier.name}: ${mint.publicKey.toString()}`);

      // The `collectionMint` here should be the PDA of the Hybrid Collection itself.
      // Each class does not get its own mint typically; they are part of the collection.

      /* 
      // Example using a conceptual createHybridClass or similar function:
      const result = await createNft(umi, { // or createHybridClass
        // collection: collectionMintPda, // Might be implicit if operating on a collection object
        // name: tier.name,
        // symbol: `AIR${tier.tier}`,
        // uri: `https://your.api/metadata/air/${tier.tier}.json`,
        // sellerFeeBasisPoints: 0, // Example
        // maxSupply: BigInt(tier.cap),
        // underlyingMint: underlyingSplTokenMint,
        // underlyingAmount: underlyingAmountForClass,
        // authority: umi.identity, // Usually the collection authority
        // payer: umi.payer,
        // --- Other specific mpl-hybrid parameters ---
        // For mpl-hybrid, you would typically call a function like `createClass` or `addClassToCollection`
        // using the `collectionMintPda` as a reference to the main Hybrid Collection.
        // The parameters would include tier-specific details like name, symbol, URI, maxSupply,
        // and the underlying token details (mint and amount).
      }).sendAndConfirm(umi);
      
      console.log(`  Successfully created/processed Tier ${tier.name}.`);
      console.log(`  Transaction signature: ${result.signature.toString()}`);
      */
      console.log(`  [SKIPPED] Would attempt to call a Metaplex Hybrid SDK function for Tier ${tier.name}`);
      console.log('  Ensure you are using the correct function (e.g., createClass, addClass) and parameters from mpl-hybrid for your Umi version.');

    } catch (error) {
      console.error(`  Failed to process Tier ${tier.name}:`, (error as Error).message);
      console.error('Full error object:', error);
    }
  }

  console.log('\nFinished processing all tiers.');
  console.log('Review logs for results. Remember this script requires actual on-chain addresses and a configured Umi signer.');
}

mintNftTiers().catch(console.error);

/*
Example for creating the $DEFAI SPL Token-2022 mint (run via Solana CLI):

spl-token-2022 create-token \
  --program-id TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb \
  --transfer-fee-basis-points 100 \
  --transfer-fee-maximum-fee 0 \
  --enable-close \
  DEFAI_token_mint.json # This will output the mint address

Then, create an account for this mint if needed:
spl-token-2022 create-account <DEFAI_TOKEN_MINT_ADDRESS_FROM_JSON_ABOVE>
*/ 