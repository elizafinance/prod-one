"use client";

import { useEffect, useState } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useWallet as useCrossmintWallet } from '@crossmint/client-sdk-react-ui';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WalletMinimal } from 'lucide-react'; // Using a generic wallet icon

export default function SmartWalletBalances() {
  const { connection } = useConnection(); // Mainnet connection from wallet-adapter
  const { wallet: crossmintSmartWallet } = useCrossmintWallet();

  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [defaiBalance, setDefaiBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const defaiMintAddress = process.env.NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS;
  const defaiDecimals = parseInt(process.env.NEXT_PUBLIC_DEFAI_TOKEN_DECIMALS || "9"); // Default to 9 if not set

  useEffect(() => {
    const fetchBalances = async () => {
      if (!connection || !crossmintSmartWallet?.address || !defaiMintAddress) {
        // console.log("[SmartWalletBalances] Missing connection, smart wallet address, or DEFAI mint address.");
        // setError("Prerequisites for fetching balances are not met.");
        // It might be normal for these to be initially undefined, so don't set error immediately.
        setIsLoading(false); // Ensure loading is false if prerequisites aren't met
        setSolBalance(null); // Reset balances
        setDefaiBalance(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      // console.log("[SmartWalletBalances] Fetching balances for:", crossmintSmartWallet.address);

      try {
        const smartWalletPublicKey = new PublicKey(crossmintSmartWallet.address);
        const defaiMintPublicKey = new PublicKey(defaiMintAddress);

        // Fetch SOL Balance
        const sol = await connection.getBalance(smartWalletPublicKey);
        setSolBalance(sol / LAMPORTS_PER_SOL);
        // console.log("[SmartWalletBalances] SOL Balance:", sol / LAMPORTS_PER_SOL);

        // Fetch DEFAI Balance
        try {
          const ataAddress = await getAssociatedTokenAddress(
            defaiMintPublicKey,
            smartWalletPublicKey,
            true // allowOwnerOffCurve - important for PDAs/smart contract wallets
          );
          // console.log("[SmartWalletBalances] DEFAI ATA Address:", ataAddress.toBase58());
          const ataAccountInfo = await getAccount(connection, ataAddress, 'confirmed');
          setDefaiBalance(Number(ataAccountInfo.amount) / Math.pow(10, defaiDecimals));
          // console.log("[SmartWalletBalances] DEFAI Balance:", Number(ataAccountInfo.amount) / Math.pow(10, defaiDecimals));
        } catch (tokenError: any) {
          // If ATA not found, it means 0 balance for that token
          if (tokenError.name === 'TokenAccountNotFoundError' || tokenError.message?.includes('Account not found')) {
            // console.log("[SmartWalletBalances] DEFAI ATA not found, setting balance to 0.");
            setDefaiBalance(0);
          } else {
            console.error("[SmartWalletBalances] Error fetching DEFAI token balance:", tokenError);
            setError("Failed to fetch DEFAI balance.");
            setDefaiBalance(null); // Or 0, depending on desired behavior on error
          }
        }
      } catch (err: any) {
        console.error("[SmartWalletBalances] Error fetching balances:", err);
        setError("Failed to fetch balances.");
        setSolBalance(null);
        setDefaiBalance(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalances();
    // Refresh balances if wallet address or connection changes
    // Consider adding a manual refresh button or periodic refresh if needed
  }, [connection, crossmintSmartWallet?.address, defaiMintAddress, defaiDecimals]);

  if (!crossmintSmartWallet?.address) {
    return null; // Don't render anything if no smart wallet is connected/detected
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <WalletMinimal className="h-5 w-5 mr-2 text-primary" />
          Smart Wallet Balances
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {isLoading && <p>Loading balances...</p>}
        {error && <p className="text-red-500">Error: {error}</p>}
        {!isLoading && !error && (
          <div className="space-y-2">
            <p>
              <strong>Address:</strong> 
              <a 
                href={`https://solscan.io/account/${crossmintSmartWallet.address}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="ml-1 font-mono text-xs text-blue-600 hover:underline break-all"
              >
                {crossmintSmartWallet.address}
              </a>
            </p>
            <p><strong>SOL:</strong> {solBalance !== null ? solBalance.toFixed(4) : 'N/A'}</p>
            <p><strong>DEFAI:</strong> {defaiBalance !== null ? defaiBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : 'N/A'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 