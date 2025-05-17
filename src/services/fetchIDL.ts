import { Program, AnchorProvider } from '@project-serum/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { Idl } from '@project-serum/anchor';

export async function fetchIdlFromChain(programId: string): Promise<Idl | null> {
  const connection = new Connection("https://api.devnet.solana.com");
  // Or use your preferred RPC endpoint

  // Create a minimal provider
  const provider = new AnchorProvider(
    connection,
    {} as any, // Empty wallet - using type assertion as AnchorProvider expects a wallet
    { commitment: 'confirmed' }
  );

  try {
    // Fetch the IDL from the chain
    const idl = await (Program as any).fetchIdl(new PublicKey(programId), provider);
    console.log("Retrieved IDL:", idl);
    return idl;
  } catch (error) {
    console.error("Error fetching IDL:", error);
    return null;
  }
}