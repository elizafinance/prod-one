"use client";

import { useState, useEffect, useCallback } from "react";
import CrossmintLoginButton from "@/components/CrossmintLoginButton";
import { useAuth, useWallet as useCrossmintWallet } from "@crossmint/client-sdk-react-ui";
import { Bot, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingStore, OnboardingStep } from "@/store/useOnboardingStore";
import { isAuthConnected, isAuthLoading, isAuthError } from "@/lib/crossmintStatus";
import { useWallet as usePrimarySolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, Signer } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getOrCreateAssociatedTokenAccount, createTransferInstruction } from '@solana/spl-token';
import { toast } from "sonner";

// API Payload Interfaces
interface DeployAgentRequest {
  riskTolerance: number;
  // Fleek-specific or agent config might be added here if needed by backend
}

interface DeployAgentResponse {
  agentId: string;
  status: "PENDING" | "DEPLOYING" | "ACTIVE" | "ERROR" | "RUNNING";
  message?: string;
  agentUrl?: string;
  deployedAt?: string;
  success?: boolean;
  error?: string;
}

interface SetRiskPreferenceRequest {
  riskTolerance: number;
}

// Props for functions/data needed from the parent page (YieldPage)
interface AgentOnboardingFlowProps {
  children: React.ReactNode;
  // primaryWalletPublicKey: PublicKey | null; // from useWallet() on YieldPage
  // primaryWalletSendTransaction: any; // from useWallet().sendTransaction on YieldPage
  // primaryWalletConnection: any; // from useConnection() on YieldPage
}

/**
 * AgentOnboardingFlow wraps its children and, if the user hasn't completed
 * the onboarding, shows a sequence of lightweight modal overlays guiding them
 * through: 1) Intro, 2) Crossmint wallet, 3) Staking DEFAI, 4) Deploying an
 * AI Agent on Fleek, 5) Agreeing on risk preferences.
 */
export default function AgentOnboardingFlow({
  children,
  // primaryWalletPublicKey,
  // primaryWalletSendTransaction,
  // primaryWalletConnection,
}: AgentOnboardingFlowProps) {
  const { status: crossmintStatus, jwt, user: crossmintUser } = useAuth();
  const { wallet: crossmintSmartWallet } = useCrossmintWallet(); // This is the target smart wallet

  // Get primary wallet (Phantom etc.) and connection from Solana wallet adapter context
  // This assumes AgentOnboardingFlow is rendered within the main WalletProvider context
  const { publicKey: primaryWalletPublicKey, sendTransaction: primaryWalletSendTransaction } = usePrimarySolanaWallet();
  const { connection: primaryWalletConnection } = useConnection();

  const { step, setStep, riskTolerance, setRiskTolerance, resetOnboarding } = useOnboardingStore();
  
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isSettingRisk, setIsSettingRisk] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  const requiredDefaiAmount = parseFloat(process.env.NEXT_PUBLIC_REQUIRED_DEFAI_FOR_AGENT || "10");
  const requiredSolAmount = parseFloat(process.env.NEXT_PUBLIC_REQUIRED_SOL_FOR_AGENT || "0.01");
  const defaiMintAddress = process.env.NEXT_PUBLIC_DEFAI_TOKEN_MINT_ADDRESS;

  useEffect(() => {
    const statusString = crossmintStatus as string;
    // If user connects Crossmint wallet, and we are on that step, advance to funding.
    if (step === "CONNECT_WALLET" && isAuthConnected(statusString) && crossmintSmartWallet?.address) {
      console.log("[AgentOnboardingFlow] Crossmint wallet connected/logged-in, smart wallet address available. Advancing to FUND_SMART_WALLET step.");
      setStep("FUND_SMART_WALLET");
    }
  }, [step, crossmintStatus, crossmintSmartWallet?.address, setStep]);

  const Modal = ({ children: modalChildren, showBackButton, onBack }: { children: React.ReactNode, showBackButton?: boolean, onBack?: () => void }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl text-slate-900 relative">
        {showBackButton && (
          <Button onClick={onBack} variant="ghost" size="sm" className="absolute top-4 left-4 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        )}
        {modalChildren}
      </div>
    </div>
  );

  const handleFundSmartWallet = useCallback(async () => {
    if (!primaryWalletPublicKey || !crossmintSmartWallet?.address || !primaryWalletConnection || !defaiMintAddress) {
      toast.error("Wallet connection or configuration details are missing.");
      return;
    }
    setIsProcessingPayment(true);
    setOnboardingError(null);
    toast.info("Preparing funding transactions...");

    try {
      const crossmintSmartWalletPubkey = new PublicKey(crossmintSmartWallet.address);
      const defaiMintPubkey = new PublicKey(defaiMintAddress);

      // SOL Transfer Transaction
      const solTransaction = new Transaction({
        feePayer: primaryWalletPublicKey,
        recentBlockhash: (await primaryWalletConnection.getLatestBlockhash('confirmed')).blockhash,
      }).add(
        SystemProgram.transfer({
          fromPubkey: primaryWalletPublicKey,
          toPubkey: crossmintSmartWalletPubkey,
          lamports: requiredSolAmount * LAMPORTS_PER_SOL,
        })
      );
      console.log(`Attempting to send ${requiredSolAmount} SOL...`);
      const solSignature = await primaryWalletSendTransaction!(solTransaction, primaryWalletConnection);
      await primaryWalletConnection.confirmTransaction({ signature: solSignature, blockhash: solTransaction.recentBlockhash!, lastValidBlockHeight: (await primaryWalletConnection.getLatestBlockhash()).lastValidBlockHeight }, 'confirmed');
      toast.success(`${requiredSolAmount} SOL sent successfully!`);

      // DEFAI Token Transfer Transaction
      const sourceAta = await getOrCreateAssociatedTokenAccount(
        primaryWalletConnection!,
        primaryWalletPublicKey as any,
        defaiMintPubkey,
        primaryWalletPublicKey!
      );
      const destinationAta = await getOrCreateAssociatedTokenAccount(
        primaryWalletConnection!,
        primaryWalletPublicKey as any,
        defaiMintPubkey,
        crossmintSmartWalletPubkey
      );
      const defaiAmountLamports = BigInt(Math.floor(requiredDefaiAmount * Math.pow(10, 9))); // Ensure it's an integer, then BigInt for DEFAI (9 decimals)

      const defaiTransaction = new Transaction({
        feePayer: primaryWalletPublicKey,
        recentBlockhash: (await primaryWalletConnection.getLatestBlockhash('confirmed')).blockhash,
      }).add(
        createTransferInstruction(
          sourceAta.address,
          destinationAta.address,
          primaryWalletPublicKey, // Authority for the sourceAta
          defaiAmountLamports,
          [],
          TOKEN_PROGRAM_ID
        )
      );
      console.log(`Attempting to send ${requiredDefaiAmount} DEFAI...`);
      const defaiSignature = await primaryWalletSendTransaction!(defaiTransaction, primaryWalletConnection);
      await primaryWalletConnection.confirmTransaction({ signature: defaiSignature, blockhash: defaiTransaction.recentBlockhash!, lastValidBlockHeight: (await primaryWalletConnection.getLatestBlockhash()).lastValidBlockHeight }, 'confirmed');
      toast.success(`${requiredDefaiAmount} DEFAI sent successfully!`);
      
      setStep("DEPLOY_AGENT");

    } catch (error: any) {
      console.error("[AgentOnboardingFlow] Funding error:", error);
      setOnboardingError(error.message || "Transaction failed or was rejected.");
      toast.error(`Funding error: ${error.message || "Unknown error"}`);
    } finally {
      setIsProcessingPayment(false);
    }
  }, [
    primaryWalletPublicKey, crossmintSmartWallet, primaryWalletConnection, 
    primaryWalletSendTransaction, requiredSolAmount, requiredDefaiAmount, 
    defaiMintAddress, setStep, setOnboardingError
  ]);

  // Handler for deploying agent
  const handleDeployAgent = async () => {
    setIsDeploying(true);
    setOnboardingError(null);
    console.log("[AgentOnboardingFlow] Attempting to deploy agent with risk tolerance:", riskTolerance);

    if (!jwt) {
      console.error("[AgentOnboardingFlow] No JWT found. Cannot deploy agent.");
      setOnboardingError("Authentication token not found. Please try logging in again.");
      setIsDeploying(false);
      return;
    }

    try {
      const payload: DeployAgentRequest = { riskTolerance };
      const response = await fetch("/api/agents/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      let data: DeployAgentResponse;
      try {
        data = await response.json();
      } catch (e) {
        if (!response.ok) {
          throw new Error(`Agent deployment failed: ${response.status} ${response.statusText}`);
        }
        throw new Error("Agent deployment response was not valid JSON.");
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || `Failed to deploy agent. Status: ${response.status}`);
      }
      
      console.log("[AgentOnboardingFlow] Deploy agent API response:", data);
      
      if (data.success === false) {
        throw new Error(data.message || data.error || "Agent deployment indicated failure.");
      }

      if (data.status === "RUNNING" || data.status === "DEPLOYING" || data.status === "PENDING" || data.status === "ACTIVE") {
         setStep("SET_RISK"); 
      } else {
         throw new Error(data.message || data.error || `Agent deployment status is unexpected: ${data.status}`);
      }

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

    if (!jwt) {
      console.error("[AgentOnboardingFlow] No JWT found. Cannot set risk preference.");
      setOnboardingError("Authentication token not found. Please try logging in again.");
      setIsSettingRisk(false);
      return;
    }

    try {
      const payload: SetRiskPreferenceRequest = { riskTolerance };
      const response = await fetch("/api/agents/risk", { 
        method: "PATCH", 
        headers: {
           "Content-Type": "application/json",
           "Authorization": `Bearer ${jwt}`,
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to set risk preference.");
      }
      const data = await response.json();
      console.log("[AgentOnboardingFlow] Set risk preference success:", data);
      setStep("DONE");
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
          <Modal showBackButton onBack={() => setStep("WELCOME")}>
            {resetButton}
            <h2 className="text-lg font-semibold mb-2">1. Link Your Smart Wallet</h2>
            <p className="mb-4 text-sm text-slate-600">
              Your agent needs a secure home. Connect or create a Crossmint smart
              wallet to continue.
            </p>
            <CrossmintLoginButton />
            {onboardingError && <p className="text-xs text-red-500 mt-2">Error: {onboardingError}</p>}
          </Modal>
        );
      case "FUND_SMART_WALLET":
        return (
          <Modal showBackButton onBack={() => setStep("CONNECT_WALLET")}>
            {resetButton}
            <h2 className="text-lg font-semibold mb-2">2. Fund Your Agent&apos;s Wallet</h2>
            <p className="mb-2 text-sm text-slate-600">
              To activate your agent, its smart wallet needs a small amount of SOL for transaction fees and DEFAI tokens to manage.
            </p>
            <div className="my-3 p-3 bg-slate-100 rounded-md text-xs text-slate-700 space-y-1">
              <p><strong>Target Smart Wallet:</strong><br/><span className="break-all">{crossmintSmartWallet?.address || "Not connected yet"}</span></p>
              <p><strong>Required:</strong> {requiredSolAmount} SOL & {requiredDefaiAmount} DEFAI</p>
            </div>
            {!primaryWalletPublicKey && <p className="text-xs text-amber-600 mb-2">Please connect your primary Solana wallet (e.g., Phantom) to proceed.</p>}
            <Button 
                className="w-full"
                onClick={handleFundSmartWallet} 
                disabled={isProcessingPayment || !primaryWalletPublicKey || !crossmintSmartWallet?.address}
            >
              {isProcessingPayment ? "Processing Funds..." : "Fund Agent Wallet"}
            </Button>
            {onboardingError && <p className="text-xs text-red-500 mt-2">Error: {onboardingError}</p>}
          </Modal>
        );
      case "DEPLOY_AGENT":
        return (
          <Modal showBackButton onBack={() => setStep("FUND_SMART_WALLET")}>
            {resetButton}
            <h2 className="text-lg font-semibold mb-2">3. Deploy Your AI Agent</h2>
            <p className="mb-4 text-sm text-slate-600">Your personalised agent will be deployed to Fleek&rsquo;s serverless
              infrastructure with secure key-management and its own smart wallet.
            </p>
            <Button className="w-full" onClick={handleDeployAgent} disabled={isDeploying}>{isDeploying ? "Deploying..." : "Deploy Agent"}</Button>
            {onboardingError && <p className="text-xs text-red-500 mt-2">Error: {onboardingError}</p>}
          </Modal>
        );
      case "SET_RISK":
        return (
          <Modal showBackButton onBack={() => setStep("DEPLOY_AGENT")}>
            {resetButton}
            <h2 className="text-lg font-semibold mb-2">4. Set Agent Risk Preferences</h2>
            <div className="mb-4 text-sm text-slate-600 space-y-1">
                <p>Define your agent&rsquo;s operational boundaries. This setting guides its decisions when selecting Liquidity Pools (LPs).</p>
                <ul className="list-disc list-inside text-xs pl-2 text-slate-500">
                    <li><strong>Level 1-2 (Conservative):</strong> Prefers established, lower-yield LPs with higher TVL and audit scores.</li>
                    <li><strong>Level 3 (Balanced):</strong> Aims for a mix of safety and good returns. May explore newer LPs with caution.</li>
                    <li><strong>Level 4-5 (Adventurous):</strong> May allocate to higher-yield, newer, or unaudited LPs. Higher potential reward, higher risk.</li>
                </ul>
                <p className="pt-2">Your agent will primarily operate within this risk comfort zone.</p>
            </div>
            <input type="range" min={1} max={5} step={1} value={riskTolerance} onChange={(e) => setRiskTolerance(parseInt(e.target.value))} className="w-full mb-2 accent-blue-600"/>
            <div className="text-center mb-4 text-sm font-medium text-slate-800">Selected Risk Level: <span className="text-blue-600 font-bold">{riskTolerance}</span></div>
            <Button className="w-full" onClick={handleSetRiskAndComplete} disabled={isSettingRisk}>{isSettingRisk ? "Saving..." : "Confirm & Launch Agent"}</Button>
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