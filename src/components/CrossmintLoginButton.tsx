"use client";

import { useRef, useEffect, useState } from "react";
import Script from "next/script";
import { useSession } from "next-auth/react";

// Define Step type for UI stepper
type OnboardingStep = "WALLET" | "AGENT" | "COMPLETED";

// Declare minimal types for the Crossmint global. This prevents TS errors without installing @types.
interface CrossmintUiService {
  init: (config: any) => {
    showLoginModal: () => void;
  };
}

// Extend the Window type so TypeScript recognizes the injected SDK.
declare global {
  interface Window {
    /**
     * The Crossmint vanilla UI SDK attaches itself to `window.crossmintUiService` at runtime.
     * Other ambient type definitions (for example from test mocks or 3rd-party libs) already
     * declare this property as `any`, which leads to duplicate-identifier conflicts when we
     * attempt to give it a stricter type here.  
     *
     * To avoid build failures we keep the public shape as `any` and cast to
     * `CrossmintUiService` where we need stronger typing inside the component.
     */
    crossmintUiService: any;
  }
}

export default function CrossmintLoginButton() {
  const clientRef = useRef<ReturnType<CrossmintUiService["init"]> | null>(null);
  const [session, setSession] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState<"unauthenticated" | "authenticated" | "loading">("loading");
  const { update: updateSession } = useSession();
  const crossmintModalOpened = useRef(false);
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("WALLET");
  const [errorState, setErrorState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSdkLoading, setIsSdkLoading] = useState(true);
  const [vcHash, setVcHash] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.walletAddress) {
      setCurrentStep("AGENT");
      if (!agentStatus) deployAgent();
    } else {
      setCurrentStep("WALLET");
    }
    setAuthStatus(session ? "authenticated" : "unauthenticated");
  }, [session?.user?.walletAddress, agentStatus]);

  const linkWalletToAccount = async (walletAddress: string, chainId: string) => {
    if (!session || !session.user) {
      console.error("No active user session (from JWT cookie), cannot link wallet details if needed.");
      setErrorState("User session not found. Please try connecting your wallet again.");
      setCurrentStep("WALLET");
      return;
    }
    setIsLoading(true);
    setErrorState(null);
    try {
      const response = await fetch('/api/auth/link-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress, chain: chainId }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        console.log("Wallet details processed (link-wallet):", data);
        if(data.vcAgentOwnership) setVcHash(data.vcAgentOwnership);
        setCurrentStep("AGENT");
        if(!agentStatus) deployAgent();
      } else {
        console.error("Failed to process wallet details (link-wallet):", data.error || 'Unknown error');
        setErrorState(data.error || "Failed to process wallet details. Please try again.");
      }
    } catch (error) {
      console.error("Error calling link-wallet API:", error);
      setErrorState("An unexpected error occurred. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const initializeCrossmint = () => {
    console.log("[CrossmintButton] initializeCrossmint called. window.crossmintUiService exists:", !!window.crossmintUiService, "clientRef.current exists:", !!clientRef.current);

    if (typeof window !== "undefined" && (window.crossmintUiService as CrossmintUiService) && !clientRef.current) {
      try {
        const clientId = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_SIDE;
        if (!clientId) {
          console.error("[CrossmintButton] Error: NEXT_PUBLIC_CROSSMINT_CLIENT_SIDE is not set. Cannot initialize SDK.");
          setErrorState("Crossmint configuration error: Client ID is missing. Please contact support.");
          setIsSdkLoading(false);
          return;
        }

        const client = (window.crossmintUiService as CrossmintUiService).init({
          clientId: clientId,
          environment: process.env.NEXT_PUBLIC_CROSSMINT_ENVIRONMENT || "production",
          callbacks: { 
            onLoginSuccess: async (address: string, chainIdentifier: string) => { 
                console.log(`Crossmint login success. Address: ${address}, Chain: ${chainIdentifier}`);
                setErrorState(null);
                setIsLoading(true);
                try {
                  const loginRes = await fetch("/api/auth/wallet-login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ walletAddress: address, chain: chainIdentifier }),
                  });
                  const loginData = await loginRes.json();
                  if (!loginRes.ok || !loginData.success) {
                    throw new Error(loginData.error || "Wallet login failed. Please try again.");
                  }
                  console.log("Wallet login successful, auth cookie set.", loginData);
                  setSession({ user: { id: loginData.userId, walletAddress: loginData.walletAddress, walletChain: chainIdentifier } });
                  setAuthStatus("authenticated");
                  await linkWalletToAccount(address, chainIdentifier);
                } catch (e: any) {
                  console.error("Error during wallet login/linking process:", e);
                  setErrorState(e.message || "An error occurred during wallet processing.");
                  setCurrentStep("WALLET");
                } finally {
                  setIsLoading(false);
                }
            },
            onLoginFailure: (error: any) => {
                console.error("Crossmint login failed:", error);
                setErrorState(error?.message || "Crossmint login failed. Please try again.");
            },
          }
        });

        if (client && typeof client.showLoginModal === 'function') {
            clientRef.current = client;
            setIsSdkLoading(false);
            console.log("[CrossmintButton] Crossmint SDK initialized and clientRef set.");
        } else {
            console.error("[CrossmintButton] Crossmint SDK init() did not return a valid client object. Client:", client);
            setErrorState("Could not initialize Crossmint client. Please refresh.");
            setIsSdkLoading(false);
        }
      } catch (error: any) {
        console.error("[CrossmintButton] Failed to init Crossmint SDK:", error);
        setErrorState(error?.message || "Could not initialize Crossmint. Please refresh.");
        setIsSdkLoading(false);
      }
    } else if (!clientRef.current) {
      // This path is taken if:
      // 1. window.crossmintUiService was falsy (e.g. undefined, null) when initializeCrossmint was called, AND
      // 2. clientRef.current is null (meaning SDK hasn't been successfully initialized and stored yet).
      // This situation is typically observed when initializeCrossmint is called from the Script's onReady,
      // and window.crossmintUiService isn't immediately available.
      console.error("[CrossmintButton] initializeCrossmint: Failed to find window.crossmintUiService immediately after script onReady or clientRef is unexpectedly null. SDK cannot be initialized.");
      setErrorState("Wallet services (Crossmint SDK) could not be found after loading. Please refresh the page or check adblockers.");
      setIsSdkLoading(false); // Ensure loading state is cleared and an error is shown.
    } else {
      // This case means clientRef.current is already set. SDK should be initialized.
      console.log("[CrossmintButton] initializeCrossmint: Client already initialized (clientRef.current exists).");
      // If clientRef is already set, isSdkLoading should ideally be false.
      // We can add a safety check here, though it should have been set when clientRef was first populated.
      if (isSdkLoading) {
        setIsSdkLoading(false);
      }
    }
  };

  useEffect(() => {
    // This useEffect acts as a fallback or secondary check.
    // The primary initialization path is via the Script tag's onReady.
    // If, for some reason, onReady doesn't trigger initializeCrossmint or it fails silently,
    // this effect might catch it if crossmintUiService becomes available later.
    if (!clientRef.current && typeof window !== "undefined") {
        // If the service isn't immediately available, try to initialize after a short delay.
        // This can help if the service attaches itself slightly after the initial component render.
        const timer = setTimeout(() => {
            if (window.crossmintUiService && !clientRef.current) {
                console.log("[CrossmintButton] useEffect: Initializing Crossmint via setTimeout as service found and client not set.");
                initializeCrossmint();
            } else if (!window.crossmintUiService) {
                console.warn("[CrossmintButton] useEffect: window.crossmintUiService still not found after delay. SDK may not have loaded correctly or is blocked.");
                // Optionally, set an error state here if it's critical and not handled elsewhere
            }
        }, 200); // Increased delay slightly for this fallback.
        return () => clearTimeout(timer);
    }
  }, []); // Empty dependency array means this runs once on mount.

  useEffect(() => {
    if (authStatus === "authenticated" && currentStep === "WALLET" && clientRef.current && crossmintModalOpened.current && !isSdkLoading) {
        console.log("[CrossmintButton] User authenticated, needs wallet, modal previously flagged, SDK ready. Showing Crossmint modal.");
        setErrorState(null); 
        clientRef.current.showLoginModal();
        crossmintModalOpened.current = false;
    }
  }, [authStatus, currentStep, isSdkLoading]);

  const deployAgent = async () => {
    if (agentStatus === 'Deploying...' || agentStatus === 'Running') return;
    
    console.log("[Agent Deployment] Attempting to deploy agent...");
    setIsLoading(true);
    setAgentStatus("Deploying...");
    setErrorState(null);
    try {
      const response = await fetch('/api/agents/deploy', { method: 'POST' });
      const data = await response.json();
      if (response.ok && data.success) {
        console.log("[Agent Deployment] Success:", data);
        setAgentStatus(data.status || "Running");
        setCurrentStep("COMPLETED");
      } else {
        console.error("[Agent Deployment] Failed:", data.error || 'Unknown error');
        setErrorState(data.error || "Failed to deploy agent.");
        setAgentStatus("Deployment Failed");
      }
    } catch (error) {
      console.error("[Agent Deployment] API Error:", error);
      setErrorState("Error communicating with agent deployment service.");
      setAgentStatus("Deployment Failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    setErrorState(null);
    if (isLoading) return;

    if (isSdkLoading) {
        setErrorState("Wallet services are still initializing. Please wait a moment.");
        return;
    }

    if (!clientRef.current) {
        console.warn("[CrossmintButton] clientRef not set even though SDK should be ready. Attempting re-init.");
        initializeCrossmint(); 
        if (!clientRef.current) {
            setErrorState("Wallet services could not be initialized. Please refresh the page.");
            return;
        }
    }

    switch (currentStep) {
      case "WALLET":
        if (clientRef.current) {
          console.log("[CrossmintButton] Showing Crossmint login modal.");
          crossmintModalOpened.current = true;
          clientRef.current.showLoginModal();
        } else {
          setErrorState("Wallet connection service not ready. Please refresh and try again.");
        }
        break;
      case "AGENT":
        deployAgent();
        break;
      case "COMPLETED":
        console.log("Process completed. Agent should be running.");
        break;
    }
  };
  
  const getButtonText = () => {
    if (isSdkLoading && currentStep === "WALLET") return "Initializing Wallet...";
    if (isLoading) return "Processing...";
    switch (currentStep) {
      case "WALLET": return "Connect Wallet with Crossmint";
      case "AGENT": return agentStatus === "Deploying..." ? "Deploying Agent..." : (agentStatus === "Running" ? "Agent Running" : "Deploy Agent");
      case "COMPLETED": return "View Agent Dashboard";
      default: return "Connect Wallet with Crossmint";
    }
  };

  return (
    <div className="p-4 border rounded-lg max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-3 text-center">Your AI Agent Setup</h2>
      <div className={`flex justify-between mb-4 text-xs`}>
        <span className={`p-1 ${(currentStep === "WALLET" || currentStep === "AGENT" || currentStep === "COMPLETED") ? (session?.user?.walletAddress ? 'font-bold text-blue-600' : 'font-bold') : 'text-gray-500'}`}>1. Link Wallet</span>
        <span className={`p-1 ${(currentStep === "AGENT" || currentStep === "COMPLETED") ? (agentStatus === "Running" ? 'font-bold text-blue-600' : 'font-bold') : 'text-gray-500'}`}>2. Deploy Agent</span>
        <span className={`p-1 ${currentStep === "COMPLETED" ? 'font-bold text-blue-600' : 'text-gray-500'}`}>3. Completed</span>
      </div>

      <Script
        src="https://unpkg.com/@crossmint/client-sdk-vanilla-ui@latest/dist/index.global.js"
        strategy="afterInteractive"
        onReady={() => {
          console.log("[CrossmintButton] Crossmint SDK script ready (onReady). Attempting to initialize.");
          initializeCrossmint();
        }}
        onError={(e) => {
            console.error("[CrossmintButton] Failed to load Crossmint SDK script:", e);
            setErrorState("Could not load wallet services. Please check your internet connection or adblockers and refresh.");
            setIsSdkLoading(false);
        }}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading || (isSdkLoading && currentStep === "WALLET") || (currentStep === "AGENT" && agentStatus === "Running") || (currentStep === "COMPLETED")}
        className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-all duration-150 ease-in-out"
      >
        {getButtonText()}
      </button>
      {errorState && (
        <p className="mt-2 text-sm text-red-500 bg-red-100 p-2 rounded">Error: {errorState}</p>
      )}
      {vcHash && currentStep !== "WALLET" && (
        <p className="mt-2 text-xs text-green-700 bg-green-100 p-2 rounded">Agent Ownership VC: {vcHash.substring(0,20)}...</p>
      )}
      {session?.user?.walletAddress && (
        <p className="mt-1 text-xs text-gray-600">Wallet: {session.user.walletAddress.substring(0,6)}...{session.user.walletAddress.substring(session.user.walletAddress.length - 4)} ({session.user.walletChain})</p>
      )}
      {agentStatus && (agentStatus === "Running" || agentStatus === "Deployment Failed") && (
          <p className={`mt-1 text-xs ${agentStatus === "Running" ? "text-green-700" : "text-red-700"}`}>Agent Status: {agentStatus}</p>
      )}
       {(currentStep === "COMPLETED" || (currentStep === "AGENT" && agentStatus === "Running")) && (
        <div className="mt-4 p-3 border-t border-gray-200 text-center">
            <p className="text-sm font-semibold">Agent is Active!</p>
            <p className="text-xs text-gray-600">You can now collaborate with your agent.</p>
        </div>
       )}
    </div>
  );
} 