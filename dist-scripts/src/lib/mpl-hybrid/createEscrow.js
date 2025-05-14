import { initEscrowV1, MPL_HYBRID_PROGRAM_ID, } from "@metaplex-foundation/mpl-hybrid";
import { findAssociatedTokenPda, SPL_ASSOCIATED_TOKEN_PROGRAM_ID, } from "@metaplex-foundation/mpl-toolbox";
import { publicKey, sol } from "@metaplex-foundation/umi";
import { publicKey as publicKeySerializer, string, } from "@metaplex-foundation/umi/serializers";
import umiWithCurrentWalletAdapter from "../umi/umiWithCurrentWalletAdapter";
import sendAndConfirmWalletAdapter from "../umi/sendAndConfirmWithWalletAdapter";
const createEscrow = async (createEscrowArgs) => {
    const umi = umiWithCurrentWalletAdapter();
    const escrowName = createEscrowArgs.name;
    const collectionAddress = process.env.NEXT_PUBLIC_COLLECTION_ADDRESS;
    if (!collectionAddress) {
        throw new Error("Collection address not found");
    }
    const tokenMint = process.env.NEXT_PUBLIC_TOKEN_ADDRESS; // THE TOKEN TO BE DISPENSED
    if (!tokenMint) {
        throw new Error("Token mint not found");
    }
    // Metadata Uri Pool
    const baseMetadataPoolUri = createEscrowArgs.metadataBaseUrl; // required to support metadata updating on swap
    // Min and Max Asset Indexes for the NFTs in the pool to be swapped
    const minAssetIndex = createEscrowArgs.minIndex; // I.E. https://shdw-drive.genesysgo.net/.../0.json
    const maxAssetIndex = createEscrowArgs.maxIndex; // I.E. https://shdw-drive.genesysgo.net/.../5000.json
    // Fee Wallet and Token Account
    const feeWallet = createEscrowArgs.feeWalletAddress;
    const feeTokenAccount = findAssociatedTokenPda(umi, {
        mint: publicKey(tokenMint),
        owner: publicKey(feeWallet),
    });
    // Fee Amounts
    const swapToTokenValueReceived = createEscrowArgs.tokenSwapCost; // USERS RECEIVE THIS AMOUNT WHEN SWAPPING TO FUNGIBLE TOKENS
    const swapToNftTokenFee = createEscrowArgs.tokenSwapFee; // USERS PAY THIS ADDITIONAL AMOUNT WHEN SWAPPING TO NFTS
    const swapToNftSolFee = createEscrowArgs.solSwapFee; // OPTIONAL ADDITIONAL SOLANA FEE TO PAY WHEN SWAPPING TO NFTS
    const rerollEnabled = createEscrowArgs.reroll ? 1 : 0;
    const escrowAddress = umi.eddsa.findPda(MPL_HYBRID_PROGRAM_ID, [
        string({ size: "variable" }).serialize("escrow"),
        publicKeySerializer().serialize(collectionAddress),
    ]);
    const initTx = initEscrowV1(umi, {
        // Escrow Name
        name: escrowName,
        // Metadata Pool Base Uri
        uri: baseMetadataPoolUri,
        // Escrow Address based on "escrow" + collection address seeds
        escrow: escrowAddress,
        // Collection Address
        collection: publicKey(collectionAddress),
        // Token Mint
        token: publicKey(tokenMint),
        // Fee Wallet
        feeLocation: publicKey(feeWallet),
        // Fee Token Account
        feeAta: feeTokenAccount,
        // Min index of NFTs in the pool
        min: minAssetIndex,
        // Max index of NFTs in the pool
        max: maxAssetIndex,
        // Amount of fungible token to swap to
        amount: swapToTokenValueReceived,
        // Fee amount to pay when swapping to NFTs
        feeAmount: swapToNftTokenFee,
        // Optional additional fee to pay when swapping to NFTs
        solFeeAmount: sol(0.5).basisPoints,
        // Reroll metadata on swap 0 = true, 1 = false
        path: rerollEnabled,
        // Associated Token Program ID
        associatedTokenProgram: SPL_ASSOCIATED_TOKEN_PROGRAM_ID,
    });
    const res = await sendAndConfirmWalletAdapter(initTx);
    console.log(res.signature[0]);
};
export default createEscrow;
