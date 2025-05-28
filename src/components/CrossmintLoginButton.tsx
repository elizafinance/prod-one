"use client";

import { useRef, useEffect, useState } from "react";
import Script from "next/script";
import { useSession, signIn } from "next-auth/react";

// Define Step type for UI stepper
type OnboardingStep = "AUTH" | "WALLET" | "AGENT" | "COMPLETED";

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
  const { data: session, status, update: updateSession } = useSession();
  const crossmintModalOpened = useRef(false);
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("AUTH");
  const [errorState, setErrorState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [vcHash, setVcHash] = useState<string | null>(null); // To store VC hash from backend
  const [agentStatus, setAgentStatus] = useState<string | null>(null); // Placeholder for agent status

  useEffect(() => {
    // Update step based on session and wallet status
    if (status === "authenticated") {
      if (session.user?.walletAddress) {
        setCurrentStep("AGENT"); // Wallet linked, move to agent step
        // Potentially trigger agent deployment check here if not already deploying/deployed
        if (!agentStatus) deployAgent(); // Auto-trigger deploy if wallet is linked and no agent status
      } else {
        setCurrentStep("WALLET"); // Authenticated, needs wallet
      }
    } else {
      setCurrentStep("AUTH"); // Needs X auth
    }
  }, [status, session?.user?.walletAddress]);

  const linkWalletToAccount = async (walletAddress: string, chainId: string) => {
    if (!session || !session.user) {
      console.error("No active session, cannot link wallet.");
      setErrorState("Session expired. Please log in with X again.");
      setCurrentStep("AUTH");
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
        body: JSON.stringify({ walletAddress, chain: chainId }), // Pass chainId as chain
      });
      const data = await response.json();
      if (response.ok && data.success) {
        console.log("Wallet linked successfully:", data);
        setVcHash(data.vcAgentOwnership); // Store VC Hash
        await updateSession(); // This will refresh session and trigger useEffect to change step
        // deployAgent(); // Now handled by useEffect when step becomes AGENT
      } else {
        console.error("Failed to link wallet:", data.error || 'Unknown error');
        setErrorState(data.error || "Failed to link wallet. Please try again.");
      }
    } catch (error) {
      console.error("Error calling link-wallet API:", error);
      setErrorState("An unexpected error occurred. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const initializeCrossmint = () => {
    if (typeof window !== "undefined" && window.crossmintUiService && !clientRef.current) {
      try {
        const client = window.crossmintUiService.init({
          clientId: process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_SIDE,
          environment: "staging",
          // walletConfig: { chain: "polygon" }, // Can be more dynamic based on user choice if needed
          callbacks: { 
            onLoginSuccess: (address: string, chainIdentifier: string) => { 
                console.log(`Crossmint login success. Address: ${address}, Chain: ${chainIdentifier}`);
                setErrorState(null);
                linkWalletToAccount(address, chainIdentifier); 
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
      console.log("User authenticated with X, needs wallet, showing Crossmint modal.");
      setErrorState(null); 
      clientRef.current.showLoginModal();
      crossmintModalOpened.current = false;
    }
  }, [status, currentStep]); // Re-run when session status or currentStep changes

  const deployAgent = async () => {
    if (agentStatus === 'Deploying...' || agentStatus === 'Running') return; // Prevent multiple calls
    
    console.log("[Agent Deployment] Attempting to deploy agent...");
    setIsLoading(true);
    setAgentStatus("Deploying...");
    setErrorState(null);
    try {
      const response = await fetch('/api/agents/deploy', { method: 'POST' });
      const data = await response.json();
      if (response.ok && data.success) {
        console.log("[Agent Deployment] Success:", data);
        setAgentStatus(data.status || "Running"); // Assuming backend returns agentId and status
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

    initializeCrossmint(); // Ensure it's initialized
    
    if (!clientRef.current && window.crossmintUiService && currentStep !== "AUTH") {
        console.warn("Crossmint client not initialized despite SDK script load. Attempting re-init.");
        initializeCrossmint(); 
        if (!clientRef.current) {
            setErrorState("Wallet services are not ready. Please wait a moment or refresh.");
            return;
        }
    } else if (!window.crossmintUiService && currentStep !== "AUTH"){
        setErrorState("Wallet services are loading. Please try again in a few seconds.");
        return;
    }

    switch (currentStep) {
      case "AUTH":
        console.log("Initiating X login.");
        signIn("twitter");
        break;
      case "WALLET":
        if (clientRef.current) {
          console.log("Showing Crossmint login modal.");
          crossmintModalOpened.current = true; // Set flag to open modal
          clientRef.current.showLoginModal();
        } else {
          setErrorState("Wallet connection service not ready. Please refresh.");
        }
        break;
      case "AGENT":
        deployAgent();
        break;
      case "COMPLETED":
        console.log("Process completed. Agent should be running.");
        // Maybe navigate to a dashboard or show agent info
        break;
    }
  };
  
  const getButtonText = () => {
    if (isLoading) return "Processing...";
    switch (currentStep) {
      case "AUTH": return "Login with X";
      case "WALLET": return "Connect Wallet with Crossmint";
      case "AGENT": return agentStatus === "Deploying..." ? "Deploying Agent..." : (agentStatus === "Running" ? "Agent Running" : "Deploy Agent");
      case "COMPLETED": return "View Agent Dashboard"; // Or similar
      default: return "Login with Crossmint";
    }
  };

  return (
    <div className="p-4 border rounded-lg max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-3 text-center">Your AI Agent Setup</h2>
      {/* Stepper UI (Basic) */}
      <div className="flex justify-between mb-4 text-xs">
        <span className={`p-1 ${currentStep === "AUTH" ? 'font-bold text-blue-600' : 'text-gray-500'}`}>1. Authenticate</span>
        <span className={`p-1 ${currentStep === "WALLET" || currentStep === "AGENT" || currentStep === "COMPLETED" ? (session?.user?.walletAddress ? 'font-bold text-blue-600' : 'font-bold') : 'text-gray-500'}`}>2. Link Wallet</span>
        <span className={`p-1 ${currentStep === "AGENT" || currentStep === "COMPLETED" ? (agentStatus === "Running" ? 'font-bold text-blue-600' : 'font-bold') : 'text-gray-500'}`}>3. Deploy Agent</span>
      </div>

      <Script
        src="https://unpkg.com/@crossmint/client-sdk-vanilla-ui@latest/dist/index.global.js"
        strategy="lazyOnload"
        onLoad={() => {
          console.log("Crossmint SDK script loaded via onLoad.");
          initializeCrossmint();
          // If user was already authenticated and waiting for wallet link, and modal was intended to open
          if (status === "authenticated" && currentStep === "WALLET" && crossmintModalOpened.current && clientRef.current) {
            console.log("SDK loaded, user authenticated, modal flag set, showing Crossmint modal.");
            clientRef.current.showLoginModal();
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
      {vcHash && currentStep !== "AUTH" && currentStep !== "WALLET" && (
        <p className="mt-2 text-xs text-green-700 bg-green-100 p-2 rounded">Agent Ownership VC: {vcHash.substring(0,20)}...</p>
      )}
      {session?.user?.walletAddress && (
        <p className="mt-1 text-xs text-gray-600">Wallet: {session.user.walletAddress.substring(0,6)}...{session.user.walletAddress.substring(session.user.walletAddress.length - 4)} ({session.user.walletChain})</p>
      )}
      {agentStatus && (agentStatus === "Running" || agentStatus === "Deployment Failed") && (
          <p className={`mt-1 text-xs ${agentStatus === "Running" ? "text-green-700" : "text-red-700"}`}>Agent Status: {agentStatus}</p>
      )}
       {/* Placeholder for symbiotic work UI */}
       {(currentStep === "COMPLETED" || (currentStep === "AGENT" && agentStatus === "Running")) && (
        <div className="mt-4 p-3 border-t border-gray-200 text-center">
            <p className="text-sm font-semibold">Agent is Active!</p>
            <p className="text-xs text-gray-600">You can now collaborate with your agent.</p>
            {/* TODO: Add UI for agent interaction, earnings display etc. */}
        </div>
       )}
    </div>
  );
} 