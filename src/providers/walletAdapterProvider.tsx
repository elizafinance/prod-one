"use client";

import {
  ConnectionProvider,
  WalletProvider
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import React, { FC, useMemo, useState, useEffect } from "react";

// Default styles that can be overridden by your app
import "@solana/wallet-adapter-react-ui/styles.css";

// Import wallet adapters that work across desktop & mobile (in-app browsers / deep links)
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";

type Props = {
  children?: React.ReactNode;
};

export const WalletAdapterProvider: FC<Props> = ({ children }) => {
  const [connectionReady, setConnectionReady] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // Define the Solana cluster endpoint, preferring Helius RPC URL
  const endpoint = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 
                  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
                  "https://api.devnet.solana.com"; // Fallback to devnet for development if no URL provided
  
  useEffect(() => {
    // Verify endpoint starts with http:// or https://
    if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
      setConnectionError('Invalid RPC URL: endpoint must start with http:// or https://');
      console.error('Invalid RPC URL:', endpoint);
      return;
    }
    
    // Log connection information
    // Log connection information (mask API key for security)
    const maskedEndpoint = endpoint.includes('api-key=') 
      ? endpoint.replace(/api-key=[^&]+/, 'api-key=***')
      : endpoint;
    console.log(`Initializing Solana connection to: ${maskedEndpoint}`);
    setConnectionReady(true);
  }, [endpoint]);

  // Pick the Solana cluster based on the RPC URL the dApp is pointing to.
  // This is required by some adapters (e.g. Solflare) to generate the correct deeplink.
  const network: WalletAdapterNetwork = useMemo(() => {
    if (endpoint.includes("devnet")) return WalletAdapterNetwork.Devnet;
    if (endpoint.includes("testnet")) return WalletAdapterNetwork.Testnet;
    return WalletAdapterNetwork.Mainnet; // default
  }, [endpoint]);

  // Initialise a set of common adapters that also work inside mobile in-app browsers.
  // Keeping this list lean prevents unnecessary bundle-size bloat.
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(), // Phantom (desktop & mobile)
      new SolflareWalletAdapter({ network }), // Solflare (desktop & mobile with deeplink)
    ],
    [network]
  );

  if (connectionError) {
    return <div className="text-red-500 p-4">Error connecting to Solana: {connectionError}</div>;
  }

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {connectionReady ? children : <div>Establishing connection...</div>}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
