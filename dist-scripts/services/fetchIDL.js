import { Program, AnchorProvider } from '@project-serum/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
export async function fetchIdlFromChain(programId) {
    const connection = new Connection("https://api.devnet.solana.com");
    // Or use your preferred RPC endpoint
    // Create a minimal provider
    const provider = new AnchorProvider(connection, {}, // Empty wallet - using type assertion as AnchorProvider expects a wallet
    { commitment: 'confirmed' });
    try {
        // Fetch the IDL from the chain
        const idl = await Program.fetchIdl(new PublicKey(programId), provider);
        console.log("Retrieved IDL:", idl);
        return idl;
    }
    catch (error) {
        console.error("Error fetching IDL:", error);
        return null;
    }
}
