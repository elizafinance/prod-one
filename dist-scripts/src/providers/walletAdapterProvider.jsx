"use client";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import React, { useMemo, useState, useEffect } from "react";
// Default styles that can be overridden by your app
import "@solana/wallet-adapter-react-ui/styles.css";
export const WalletAdapterProvider = ({ children }) => {
    const [connectionReady, setConnectionReady] = useState(false);
    const [connectionError, setConnectionError] = useState(null);
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
        console.log(`Initializing Solana connection to: ${endpoint}`);
        setConnectionReady(true);
    }, [endpoint]);
    const wallets = useMemo(() => [
    /**
     * Wallets that implement either of these standards will be available automatically.
     *
     *   - Solana Mobile Stack Mobile Wallet Adapter Protocol
     *     (https://github.com/solana-mobile/mobile-wallet-adapter)
     *   - Solana Wallet Standard
     *     (https://github.com/anza-xyz/wallet-standard)
     *
     * If you wish to support a wallet that supports neither of those standards,
     * instantiate its legacy wallet adapter here. Common legacy adapters can be found
     * in the npm package `@solana/wallet-adapter-wallets`.
     */
    ], 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);
    if (connectionError) {
        return <div className="text-red-500 p-4">Error connecting to Solana: {connectionError}</div>;
    }
    return (<ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {connectionReady ? children : <div>Establishing connection...</div>}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>);
};
