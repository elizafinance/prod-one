"use client";

import { useState, useEffect } from "react";
import CrossmintLoginButton from "@/components/CrossmintLoginButton";
import { useAuth } from "@crossmint/client-sdk-react-ui";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingStore, OnboardingStep } from "@/store/useOnboardingStore";
import { isAuthConnected, isAuthLoading, isAuthError } from "@/lib/crossmintStatus";

// API Payload Interfaces
interface DeployAgentRequest {
  riskTolerance: number;
}

interface DeployAgentResponse {
  agentId: string;
  status: "PENDING" | "DEPLOYING" | "ACTIVE" | "ERROR";
  message?: string;
}

interface SetRiskPreferenceRequest {
  riskTolerance: number;
}

/**
 * AgentOnboardingFlow wraps its children and, if the user hasn't completed
 * the onboarding, shows a sequence of lightweight modal overlays guiding them
 * through: 1) Intro, 2) Crossmint wallet, 3) Staking DEFAI, 4) Deploying an
 * AI Agent on Fleek, 5) Agreeing on risk preferences.
 */
export default function AgentOnboardingFlow({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status: crossmintStatus } = useAuth();
  const { step, setStep, riskTolerance, setRiskTolerance, resetOnboarding } = useOnboardingStore();
  
  // Local UI state for API call loading/errors within the modals
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSettingRisk, setIsSettingRisk] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  // Automatically advance once wallet is connected/logged-in
  useEffect(() => {
    const statusString = crossmintStatus as string;
    if (step === "CONNECT_WALLET" && isAuthConnected(statusString)) {
      console.log("[AgentOnboardingFlow] Crossmint connected/logged-in, advancing to STAKE step.");
      setStep("STAKE");
    }
  }, [step, crossmintStatus, setStep, isAuthConnected]);

  // Simple modal wrapper
  const Modal = ({ children: modalChildren }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl text-slate-900">{modalChildren}</div>
    </div>
  );

  // Handler for deploying agent
  const handleDeployAgent = async () => {
    setIsDeploying(true);
    setOnboardingError(null);
    console.log("[AgentOnboardingFlow] Attempting to deploy agent with risk tolerance:", riskTolerance);
    try {
      const payload: DeployAgentRequest = { riskTolerance };
      // const response = await fetch("/api/agents/deploy", { /* ... */ });
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      const mockResponse: DeployAgentResponse = { agentId: "mock-agent-id-123", status: "DEPLOYING", message: "Agent deployment initiated."};
      console.log("[AgentOnboardingFlow] Mock deploy response:", mockResponse);
      setStep("SET_RISK");
    } catch (error: any) {
      console.error("[AgentOnboardingFlow] Error deploying agent:", error);
      setOnboardingError(error.message || "An unexpected error occurred during deployment.");
    } finally {
      setIsDeploying(false);
    }
  };

  // Handler for setting risk and completing onboarding
  const handleSetRiskAndComplete = async () => {
    setIsSettingRisk(true);
    setOnboardingError(null);
    console.log("[AgentOnboardingFlow] Attempting to set risk preference:", riskTolerance);
    try {
      const payload: SetRiskPreferenceRequest = { riskTolerance };
      // Actual fetch to /api/agents/risk (or new dedicated user preference endpoint)
      const response = await fetch("/api/agents/risk", { 
        method: "PATCH", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to set risk preference.");
      }
      const data = await response.json();
      console.log("[AgentOnboardingFlow] Set risk preference success:", data);
      setStep("DONE"); // This will also trigger localStorage update via the store
    } catch (error: any) {
      console.error("[AgentOnboardingFlow] Error setting risk preference:", error);
      setOnboardingError(error.message || "An unexpected error occurred while setting risk.");
    } finally {
      setIsSettingRisk(false);
    }
  };

  const renderContent = () => {
    // For testing: button to reset onboarding state
    const resetButton = process.env.NODE_ENV === 'development' ? (
        <Button onClick={resetOnboarding} variant="link" size="sm" className="absolute top-2 right-2 text-xs">Reset Onboarding</Button>
    ) : null;

    switch (step) {
      case "WELCOME":
        return (
          <Modal>
            {resetButton}
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2"><Bot className="h-5 w-5 text-blue-600" /> Human-Agent Symbiosis</h2>
            <p className="mb-4 text-sm leading-relaxed text-slate-700">Welcome to DEFAI Yield. Together, you and your on-chain AI agent
              will optimise liquidity-provision strategies while you retain
              full sovereignty.
            </p>
            <Button className="w-full" onClick={() => setStep("CONNECT_WALLET")}>Begin</Button>
          </Modal>
        );
      case "CONNECT_WALLET":
        return (
          <Modal>
            {resetButton}
            <h2 className="text-lg font-semibold mb-2">1. Link a Smart Wallet</h2>
            <p className="mb-4 text-sm text-slate-600">
              Your agent needs a secure home. Connect or create a Crossmint smart
              wallet to continue.
            </p>
            <CrossmintLoginButton />
          </Modal>
        );
      case "STAKE":
        return (
          <Modal>
            {resetButton}
            <h2 className="text-lg font-semibold mb-2">2. Stake DEFAI Tokens</h2>
            <p className="mb-4 text-sm text-slate-600">
              Stake a minimum amount of DEFAI to bootstrap your agent&rsquo;s fuel
              reserves and unlock deployment.
            </p>
            <Button className="w-full" onClick={() => setStep("DEPLOY_AGENT")}>I&rsquo;ve Staked</Button>
          </Modal>
        );
      case "DEPLOY_AGENT":
        return (
          <Modal>
            {resetButton}
            <h2 className="text-lg font-semibold mb-2">3. Deploy Agent on Fleek</h2>
            <p className="mb-4 text-sm text-slate-600">
              Your personalised agent will be deployed to Fleek&rsquo;s serverless
              infrastructure with secure key-management.
            </p>
            <Button className="w-full" onClick={handleDeployAgent} disabled={isDeploying}>
              {isDeploying ? "Deploying..." : "Deploy Agent"}
            </Button>
            {onboardingError && <p className="text-xs text-red-500 mt-2">Error: {onboardingError}</p>}
          </Modal>
        );
      case "SET_RISK":
        return (
          <Modal>
            {resetButton}
            <h2 className="text-lg font-semibold mb-2">4. Set Risk Preferences</h2>
            <p className="mb-4 text-sm text-slate-600">
              Adjust the slider to indicate how adventurous your agent may be
              when selecting LP pools.
            </p>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={riskTolerance}
              onChange={(e) => setRiskTolerance(parseInt(e.target.value))}
              className="w-full mb-4 accent-blue-600"
            />
            <div className="text-center mb-4 text-sm text-slate-700">Risk Level: {riskTolerance}</div>
            <Button className="w-full" onClick={handleSetRiskAndComplete} disabled={isSettingRisk}>
              {isSettingRisk ? "Saving..." : "Continue to Dashboard"}
            </Button>
            {onboardingError && <p className="text-xs text-red-500 mt-2">Error: {onboardingError}</p>}
          </Modal>
        );
      default:
        return null;
    }
  };

  // Do not render any modal if the step is DONE
  if (step === "DONE") {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      {renderContent()} {/* This will be null if step is DONE, due to the check above */}
    </>
  );
} 