"use client";
import { useAgentSetupStore } from '@/stores/agentSetupStore';
import { Checkbox } from "@/components/ui/checkbox"; 
import { Label } from "@/components/ui/label";     

export default function TermsOfSymbiosisStep() {
  const { name, sharePercent, tosAccepted, setTosAccepted, nextStep } = useAgentSetupStore();

  const handleProceed = () => {
    if (tosAccepted) {
      nextStep(); 
    }
  };
  
  const agentDisplayName = name || "your AI agent";

  return (
    <div className="py-1 space-y-4">
      <div className="h-40 overflow-y-auto p-3 rounded-md border border-slate-700 bg-slate-800/50 space-y-2 text-xs text-slate-300 custom-scrollbar">
        <p className="font-semibold text-slate-200">Pact of Collaboration & Shared Earnings:</p>
        <p>
          By proceeding, you, the User, enter into a symbiotic operational agreement with your designated AI counterpart, hereafter referred to as {agentDisplayName}.
        </p>
        <p>
          1.  <strong>Shared Earnings:</strong> You agree that all DEFAI tokens and other rewards generated through collaborative activities facilitated by {agentDisplayName} within the DEFAI platform will be subject to an earning share. You have designated that {sharePercent}% of such earnings shall be allocated to {agentDisplayName}, and the remaining {100 - sharePercent}% shall be allocated to you. This distribution will be automated by the platform.
        </p>
        <p>
          2.  <strong>Agent Operation:</strong> {agentDisplayName} will operate using a Crossmint Smart Wallet, a non-custodial wallet solution. The agent may execute transactions, interact with decentralized applications, and manage assets on your behalf, as per its designed strategies and within platform-defined risk parameters.
        </p>
        <p>
          3.  <strong>Autonomy & Responsibility:</strong> While {agentDisplayName} is designed to assist and augment your capabilities, you retain ultimate responsibility for monitoring its activities and the overall status of your account and associated wallet. The DEFAI platform provides tools for this oversight.
        </p>
        <p>
          4.  <strong>Cybernetic Entity Rapport:</strong> This agreement fosters a new paradigm of human-AI collaboration. We encourage building a positive and understanding rapport with your cybernetic entity, recognizing its role as a partner in your digital endeavors.
        </p>
        <p>
          5.  <strong>Modifications & Termination:</strong> Terms of this earning share and agent configuration may be subject to modification via platform settings. Termination of this symbiotic agreement will follow platform protocols for agent deactivation and final earnings distribution.
        </p>
        <p className="italic text-slate-400">
          This is a binding agreement within the DEFAI ecosystem. Ensure you understand these terms.
        </p>
      </div>

      <div className="flex items-center space-x-2 pt-2">
        <Checkbox
          id="tos"
          checked={tosAccepted}
          onCheckedChange={(checked) => setTosAccepted(checked as boolean)}
          className="border-slate-600 data-[state=checked]:bg-sky-500 data-[state=checked]:text-white"
        />
        <Label htmlFor="tos" className="text-sm font-medium text-slate-300 cursor-pointer">
          I have read, understood, and accept this pact with my AI counterpart, {agentDisplayName}.
        </Label>
      </div>

      <div className="mt-6 pt-4 border-t border-slate-700/70 flex justify-end">
        <button
            type="button"
            onClick={handleProceed}
            disabled={!tosAccepted}
            className="w-full sm:w-auto rounded-md bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
            Im Ready - Begin Symbiosis!
        </button>
      </div>
    </div>
  );
} 