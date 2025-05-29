"use client";

import { useEffect } from 'react';
import {
    CrossmintProvider,
    CrossmintAuthProvider,
} from "@crossmint/client-sdk-react-ui";

const clientApiKey = process.env.NEXT_PUBLIC_CROSSMINT_API_KEY;

// Log the API key status immediately at module scope (runs once on import)
if (typeof window !== 'undefined') { // Ensure this only runs client-side
  if (!clientApiKey) {
    console.error("[CrossmintProviders Module] CRITICAL: NEXT_PUBLIC_CROSSMINT_API_KEY is UNDEFINED or not accessible client-side. Crossmint SDK will not function.");
  } else {
    console.log("[CrossmintProviders Module] NEXT_PUBLIC_CROSSMINT_API_KEY is set."); // Avoid logging the key itself for security
  }
}

export default function CrossmintProviders({ children }: { children: React.ReactNode }) {
    // Log within the component to see if it re-renders and if the key is available then.
    useEffect(() => {
        if (!clientApiKey) {
            console.warn("[CrossmintProviders Component] API Key is missing during render. SDK functionality will be impaired.");
        } else {
            console.log("[CrossmintProviders Component] Rendering with API Key.");
        }
    }, []); // Empty dependency array, runs once on mount

    if (!clientApiKey) {
        // In development, show a more obvious error in the UI.
        // In production, you might still choose to just return <>{children}</> to not break the whole page.
        if (process.env.NODE_ENV === "development") {
            return (
                <div style={{ padding: '20px', backgroundColor: 'lightcoral', border: '2px solid red', color: 'black' }}>
                    <h3 style={{ marginTop: 0 }}>Crossmint SDK Error</h3>
                    <p><strong>NEXT_PUBLIC_CROSSMINT_API_KEY is not set.</strong></p>
                    <p>Please ensure this environment variable is correctly configured and your Next.js development server has been restarted.</p>
                    <p>The rest of the application below this message will not have Crossmint functionality.</p>
                    <hr style={{ margin: '20px 0' }} />
                    {children} {/* Still render children so the rest of the page layout isn't broken */}
                </div>
            );
        }
        return <>{children}</>; 
    }

    return (
        <CrossmintProvider apiKey={clientApiKey}>
            <CrossmintAuthProvider
                embeddedWallets={{
                    type: "evm-smart-wallet",
                    createOnLogin: "all-users",
                }}
                loginMethods={[
                    "email", 
                    "google", 
                    "farcaster", 
                    "twitter",
                    "web3",
                ]}
            >
                {children}
            </CrossmintAuthProvider>
        </CrossmintProvider>
    );
} 