"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import { useSession } from "next-auth/react"; // Keep for existing session logic if needed

// Define Step type for UI stepper - this seems related to your app's logic, not Crossmint directly
type OnboardingStep = "WALLET" | "AGENT" | "COMPLETED";

export default function CrossmintLoginButton() {
  const { 
    user, 
    jwt, 
    login, 
    logout, 
    status: authHookStatus, // Renamed to avoid conflict with useWallet status
  } = useAuth();

  const { 
    wallet, 
    status: walletHookStatus, // Renamed
    error: walletError 
  } = useWallet(); // Get wallet details

  // Your existing application state (keep what's necessary)
  const [session, setSession] = useState<any>(null); // This might be replaced/augmented by Crossmint's `user` or `jwt`
  const [appAuthStatus, setAppAuthStatus] = useState<"unauthenticated" | "authenticated" | "loading">("loading");
  const { update: updateSession } = useSession(); // NextAuth session update

  const [currentStep, setCurrentStep] = useState<OnboardingStep>("WALLET");
  const [appErrorState, setAppErrorState] = useState<string | null>(null); // Renamed to avoid conflict with SDK's error
  const [isLoading, setIsLoading] = useState(false); // Your app's general loading state
  const [vcHash, setVcHash] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);

  // Define deployAgent and linkWalletToAccount with useCallback before useEffects that use them
  const deployAgent = useCallback(async () => {
    if (agentStatus === 'Deploying...' || agentStatus === 'Running') return;
    
    console.log("[Agent Deployment] Attempting to deploy agent...");
    setIsLoading(true);
    setAgentStatus("Deploying...");
    setAppErrorState(null);
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (jwt) {
        headers['Authorization'] = `Bearer ${jwt}`;
      }
      const response = await fetch('/api/agents/deploy', { method: 'POST', headers });
      const data = await response.json();
      if (response.ok && data.success) {
        console.log("[Agent Deployment] Success:", data);
        setAgentStatus(data.status || "Running");
        setCurrentStep("COMPLETED");
      } else {
        console.error("[Agent Deployment] Failed:", data.error || 'Unknown error');
        setAppErrorState(data.error || "Failed to deploy agent.");
        setAgentStatus("Deployment Failed");
      }
    } catch (error: any) {
      console.error("[Agent Deployment] API Error:", error);
      setAppErrorState(error.message || "Error communicating with agent deployment service.");
      setAgentStatus("Deployment Failed");
    } finally {
      setIsLoading(false);
    }
  }, [agentStatus, jwt, setIsLoading, setAgentStatus, setAppErrorState, setCurrentStep]);

  const linkWalletToAccount = useCallback(async (walletAddress: string, chainId: string | undefined) => { // chainId is now optional
    if (!session || !session.user) { 
      console.error("No active user session (from JWT cookie), cannot link wallet details if needed.");
      setAppErrorState("User session not found. Please try connecting your wallet again.");
      setCurrentStep("WALLET");
      return;
    }
    setIsLoading(true);
    setAppErrorState(null);
    try {
      const response = await fetch('/api/auth/link-wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ walletAddress, chain: chainId || "unknown" }), // Provide a default if chain is undefined
      });
      const data = await response.json();
      if (response.ok && data.success) {
        console.log("Wallet details processed (link-wallet):", data);
        if(data.vcAgentOwnership) setVcHash(data.vcAgentOwnership);
        setCurrentStep("AGENT");
        if(!agentStatus) deployAgent();
        updateSession(); 
      } else {
        console.error("Failed to process wallet details (link-wallet):", data.error || 'Unknown error');
        setAppErrorState(data.error || "Failed to process wallet details. Please try again.");
      }
    } catch (error: any) {
      console.error("Error calling link-wallet API:", error);
      setAppErrorState(error.message || "An unexpected error occurred. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  }, [session, updateSession, agentStatus, deployAgent, setVcHash, setCurrentStep, setAppErrorState, setIsLoading]);

  // Effect to sync Crossmint auth state with your app's auth state if needed
  useEffect(() => {
    let sdkError: string | undefined = undefined;
    const currentAuthStatus = authHookStatus as string; // Cast to string for comparison

    if (currentAuthStatus === 'error-connecting' || 
        currentAuthStatus === 'error-creating-wallet' || 
        currentAuthStatus === 'error-verifying-ownership') {
        sdkError = `Crossmint Auth Error: ${currentAuthStatus}`;
    } else if (walletHookStatus === 'loading-error') {
        sdkError = walletError || "Crossmint Wallet Error"; // Use walletError directly
    }

    if (sdkError) {
        console.error("[CrossmintButton] SDK Error:", sdkError);
        setAppErrorState(sdkError);
    } else {
        setAppErrorState(null); 
    }

    if (currentAuthStatus === 'connected' && user) {
      console.log("[CrossmintButton] Crossmint user connected:", user);
      console.log("[CrossmintButton] Crossmint JWT:", jwt);
      setAppAuthStatus("authenticated");
    } else if (currentAuthStatus === 'idle' && !user) {
      setAppAuthStatus("unauthenticated");
    } else if (currentAuthStatus === 'connecting' || 
               currentAuthStatus === 'loading-embedded-wallet' || 
               currentAuthStatus === 'loading-wallet-config') {
      setAppAuthStatus("loading");
    }
  }, [authHookStatus, user, jwt, walletHookStatus, walletError]);

  // Your existing useEffects for onboarding steps and agent deployment (adapt as needed)
  useEffect(() => {
    if (appAuthStatus === "authenticated" && wallet?.address) { 
      setCurrentStep("AGENT");
      if (!agentStatus) deployAgent();
    } else if (appAuthStatus === "unauthenticated" || (appAuthStatus === "authenticated" && !wallet?.address)) {
      setCurrentStep("WALLET");
    }
  }, [appAuthStatus, wallet, agentStatus, deployAgent]); // Added deployAgent

  // This useEffect was for Crossmint's onLoginSuccess.
  // With the React SDK, this logic should be triggered by changes in `user` or `status`.
  // The login success callback logic (fetching /api/auth/wallet-login, then linkWalletToAccount)
  // needs to be re-integrated, likely within the useEffect that watches `status === 'connected'`.
  useEffect(() => {
    const currentAuthStatus = authHookStatus as string; 
    // TODO: Determine how to get chain info. For now, passing undefined or a default.
    const chainToUse: string | undefined = undefined; // Set to undefined, or a sensible default like "polygon-amoy"
                                                // This line is the source of the build error if we try to access wallet.chain

    if (currentAuthStatus === 'connected' && wallet?.address) { 
      console.log(`Crossmint login success (detected via status change). Address: ${wallet.address}`);
      
      const processLogin = async () => {
        setIsLoading(true);
        setAppErrorState(null);
        try {
          const loginRes = await fetch("/api/auth/wallet-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: wallet.address, chain: chainToUse || "unknown" }),
          });
          const loginData = await loginRes.json();
          if (!loginRes.ok || !loginData.success) {
            throw new Error(loginData.error || "Wallet login failed. Please try again.");
          }
          console.log("Wallet login successful, auth cookie (potentially) set by your API.", loginData);
          setSession({ user: { id: loginData.userId, walletAddress: wallet.address, walletChain: chainToUse || "unknown" } });
          setAppAuthStatus("authenticated");

          await linkWalletToAccount(wallet.address, chainToUse);
          await updateSession();

        } catch (e: any) {
          console.error("Error during wallet login/linking process (post-Crossmint connection):", e);
          setAppErrorState(e.message || "An error occurred during wallet processing.");
          setCurrentStep("WALLET"); 
        } finally {
          setIsLoading(false);
        }
      };
      processLogin();
    }
  }, [authHookStatus, wallet, updateSession, linkWalletToAccount]); // Added linkWalletToAccount

  const handleConnectWallet = () => {
    setAppErrorState(null);
    const currentAuthStatus = authHookStatus as string; // Cast for comparison
    if (currentAuthStatus === 'connecting' || currentAuthStatus === 'loading-embedded-wallet') return; 
    
    console.log("[CrossmintButton] Calling Crossmint login().");
    login(); // This will open the Crossmint modal
  };

  const handleClick = () => {
    const currentAuthStatus = authHookStatus as string; // Cast for comparison
    if (isLoading || currentAuthStatus === 'connecting' || currentAuthStatus === 'loading-embedded-wallet') return; 

    switch (currentStep) {
      case "WALLET":
        if (currentAuthStatus === 'connected') {
            if (wallet?.address) {
                setCurrentStep("AGENT");
                deployAgent();
            } else {
                setAppErrorState("Wallet connected but address not found. Please try logging out and in, or check wallet status.");
            }
        } else {
            handleConnectWallet();
        }
        break;
      case "AGENT":
        deployAgent();
        break;
      case "COMPLETED":
        console.log("Process completed. Agent should be running. Consider navigation to dashboard.");
        // Example: router.push('/dashboard');
        break;
    }
  };
  
  const getButtonText = () => {
    const currentAuthStatus = authHookStatus as string; // Cast for comparison
    if (currentAuthStatus === 'connecting' || 
        currentAuthStatus === 'loading-embedded-wallet' || 
        currentAuthStatus === 'loading-wallet-config') return "Initializing Wallet...";
    if (isLoading) return "Processing..."; // Your app's general loading state
    
    switch (currentStep) {
      case "WALLET":
        return user ? "Proceed to Agent Setup" : "Connect Wallet with Crossmint";
      case "AGENT": 
        return agentStatus === "Deploying..." ? "Deploying Agent..." : (agentStatus === "Running" ? "Agent Running" : "Deploy Agent");
      case "COMPLETED": 
        return "View Agent Dashboard"; // Or "Agent Active"
      default: 
        return "Connect Wallet with Crossmint";
    }
  };

  const isButtonDisabled = () => {
    const currentAuthStatus = authHookStatus as string; // Cast for comparison
    if (isLoading || 
        currentAuthStatus === 'connecting' || 
        currentAuthStatus === 'loading-embedded-wallet') return true;
    if (currentStep === "AGENT" && agentStatus === "Running") return true;
    if (currentStep === "COMPLETED") return true; // Or false if it's a navigation button
    return false;
  };

  return (
    <div className="p-4 border rounded-lg max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-3 text-center">Your AI Agent Setup</h2>
      {/* Stepper UI - ensure this updates based on `currentStep` */}
      <div className={`flex justify-between mb-4 text-xs`}>
        <span className={`p-1 ${ (currentStep === "WALLET" || currentStep === "AGENT" || currentStep === "COMPLETED") ? (wallet?.address || appAuthStatus === 'authenticated' ? 'font-bold text-blue-600' : 'font-bold') : 'text-gray-500'}`}>1. Link Wallet</span>
        <span className={`p-1 ${ (currentStep === "AGENT" || currentStep === "COMPLETED") ? (agentStatus === "Running" ? 'font-bold text-blue-600' : 'font-bold') : 'text-gray-500'}`}>2. Deploy Agent</span>
        <span className={`p-1 ${ currentStep === "COMPLETED" ? 'font-bold text-blue-600' : 'text-gray-500'}`}>3. Completed</span>
      </div>

      {/* Removed the <Script> tag for vanilla JS SDK */}
      
      <button
        type="button"
        onClick={handleClick}
        disabled={isButtonDisabled()}
        className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-all duration-150 ease-in-out"
      >
        {getButtonText()}
      </button>

      {appErrorState && ( // Display app-specific or Crossmint SDK errors
        <p className="mt-2 text-sm text-red-500 bg-red-100 p-2 rounded">Error: {appErrorState}</p>
      )}
      
      {/* Display VC Hash, Wallet Address, Agent Status based on your app's state */}
      {vcHash && currentStep !== "WALLET" && (
        <p className="mt-2 text-xs text-green-700 bg-green-100 p-2 rounded">Agent Ownership VC: {vcHash.substring(0,20)}...</p>
      )}
      
      {/* Display wallet address, chain is uncertain for now */}
      {wallet?.address && (
        <p className="mt-1 text-xs text-gray-600">
          Wallet: {wallet.address.substring(0,6)}...{wallet.address.substring(wallet.address.length - 4)}
          {/* (Chain: {wallet.chain}) - Temporarily removed due to type error */}
        </p>
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