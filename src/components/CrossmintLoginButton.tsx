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
  const [status, setStatus] = useState<"unauthenticated" | "authenticated" | "loading">("loading");
  const { update: updateSession } = useSession();
  const crossmintModalOpened = useRef(false);
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("WALLET");
  const [errorState, setErrorState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [vcHash, setVcHash] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);

  useEffect(() => {
    if (session?.user?.walletAddress) {
      setCurrentStep("AGENT");
      if (!agentStatus) deployAgent();
    } else {
      setCurrentStep("WALLET");
    }
    setStatus(session ? "authenticated" : "unauthenticated");
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
    if (typeof window !== "undefined" && (window.crossmintUiService as CrossmintUiService) && !clientRef.current) {
      try {
        const client = (window.crossmintUiService as CrossmintUiService).init({
          clientId: process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_SIDE,
          environment: "staging",
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
                  setStatus("authenticated");
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
        clientRef.current = client;
        console.log("Crossmint SDK initialized");
      } catch (error: any) {
        console.error("Failed to init Crossmint SDK", error);
        setErrorState(error?.message || "Could not initialize Crossmint. Please refresh.");
      }
    }
  };

  useEffect(() => {
    if (window.crossmintUiService) {
      initializeCrossmint();
    }
    if (status === "authenticated" && currentStep === "WALLET" && clientRef.current && crossmintModalOpened.current) {
        console.log("User authenticated (wallet cookie), modal was flagged, showing Crossmint modal.");
        setErrorState(null); 
        (clientRef.current as any).showLoginModal();
        crossmintModalOpened.current = false;
    }
  }, [status, currentStep]);

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

    initializeCrossmint();
    
    if (!clientRef.current && window.crossmintUiService) {
        console.warn("Crossmint client not initialized despite SDK script load. Attempting re-init.");
        initializeCrossmint(); 
        if (!clientRef.current) {
            setErrorState("Wallet services are not ready. Please wait a moment or refresh.");
            return;
        }
    } else if (!window.crossmintUiService) {
        setErrorState("Wallet services are loading. Please try again in a few seconds.");
        return;
    }

    switch (currentStep) {
      case "WALLET":
        if (clientRef.current) {
          console.log("Showing Crossmint login modal.");
          crossmintModalOpened.current = true;
          (clientRef.current as any).showLoginModal();
        } else {
          setErrorState("Wallet connection service not ready. Please refresh.");
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
      <div className="flex justify-between mb-4 text-xs">
        <span className={`p-1 ${(currentStep === "WALLET" || currentStep === "AGENT" || currentStep === "COMPLETED") ? (session?.user?.walletAddress ? 'font-bold text-blue-600' : 'font-bold') : 'text-gray-500'}`}>1. Link Wallet</span>
        <span className={`p-1 ${(currentStep === "AGENT" || currentStep === "COMPLETED") ? (agentStatus === "Running" ? 'font-bold text-blue-600' : 'font-bold') : 'text-gray-500'}`}>2. Deploy Agent</span>
        <span className={`p-1 ${currentStep === "COMPLETED" ? 'font-bold text-blue-600' : 'text-gray-500'}`}>3. Completed</span>
      </div>

      <Script
        src="https://unpkg.com/@crossmint/client-sdk-vanilla-ui@latest/dist/index.global.js"
        strategy="lazyOnload"
        onLoad={() => {
          console.log("Crossmint SDK script loaded via onLoad.");
          initializeCrossmint();
          if (status === "authenticated" && currentStep === "WALLET" && crossmintModalOpened.current && clientRef.current) {
            console.log("SDK loaded, user authenticated (wallet cookie), modal flag set, showing Crossmint modal.");
            (clientRef.current as any).showLoginModal();
            crossmintModalOpened.current = false;
          }
        }}
        onError={(e) => {
            console.error("Failed to load Crossmint SDK script:", e);
            setErrorState("Could not load wallet services. Please check your internet connection or adblockers and refresh.");
        }}
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading || (currentStep === "AGENT" && agentStatus === "Running") || (currentStep === "COMPLETED")}
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