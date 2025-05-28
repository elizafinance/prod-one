"use client";

import {
    CrossmintProvider,
    CrossmintAuthProvider,
} from "@crossmint/client-sdk-react-ui";

// Ensure your environment variable is named NEXT_PUBLIC_CROSSMINT_API_KEY
const clientApiKey = process.env.NEXT_PUBLIC_CROSSMINT_API_KEY;

if (!clientApiKey) {
    console.error("Crossmint API Key (NEXT_PUBLIC_CROSSMINT_API_KEY) is not set. Please check your environment variables.");
    // Optionally, you could return a fallback UI or throw an error to prevent app initialization without the key
}

export default function CrossmintProviders({ children }: { children: React.ReactNode }) {
    if (!clientApiKey) {
        // Render children without Crossmint providers if the API key is missing, 
        // or render an error message. This prevents the app from crashing.
        return <>{children}</>; 
    }

    return (
        <CrossmintProvider apiKey={clientApiKey}>
            <CrossmintAuthProvider
                embeddedWallets={{
                    type: "evm-smart-wallet", // Or "solana-smart-wallet" or "all-wallets"
                    // defaultChain: "polygon-amoy", // Temporarily removed due to linter error
                    createOnLogin: "all-users", // Or "managed-users", "none"
                }}
                loginMethods={[
                    "email", 
                    "google", 
                    // "farcaster", 
                    // "twitter", // X (Twitter)
                    // "discord",
                    // "apple"
                ]} // Customize as needed
            >
                {children}
            </CrossmintAuthProvider>
        </CrossmintProvider>
    );
} 