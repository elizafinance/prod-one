"use client";
import { useAgentSetupStore, AgentSetupMode } from '@/stores/agentSetupStore';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface ChoiceCardProps {
  title: string;
  description: string;
  modeValue: AgentSetupMode;
  currentMode: AgentSetupMode;
  onSelect: (mode: AgentSetupMode) => void;
}

const ChoiceCard: React.FC<ChoiceCardProps> = ({ title, description, modeValue, currentMode, onSelect }) => {
  const isSelected = currentMode === modeValue;
  return (
    <button
      type="button"
      onClick={() => onSelect(modeValue)}
      className={`relative w-full p-5 rounded-lg shadow-md text-left transition-all duration-200 ease-in-out
                  border-2 hover:shadow-sky-500/30
                  ${isSelected ? 'bg-sky-700/30 border-sky-500 ring-2 ring-sky-500 ring-offset-2 ring-offset-slate-900' 
                               : 'bg-slate-800 border-slate-700 hover:border-sky-600'}`}
    >
      {isSelected && (
        <CheckCircleIcon className="h-6 w-6 text-sky-400 absolute top-3 right-3" />
      )}
      <h3 className={`text-lg font-semibold ${isSelected ? 'text-sky-400' : 'text-slate-100'}`}>{title}</h3>
      <p className={`mt-1 text-sm ${isSelected ? 'text-sky-300' : 'text-slate-400'}`}>{description}</p>
    </button>
  );
};

export default function AgentChoiceStep() {
  const { mode, setMode } = useAgentSetupStore();

  return (
    <div className="space-y-5 py-4">
      <ChoiceCard
        title="DeFAIZA - Default Symbiote"
        description="Guided by DeFAIZA, our platform\'s adept AI. She\'ll work beside you, harvesting alpha and rewards."
        modeValue="DEFAULT"
        currentMode={mode}
        onSelect={setMode}
      />
      <ChoiceCard
        title="Craft Your Own Companion"
        description="Forge a unique AI agent. Name it, define its essence, and build a personal symbiotic bond."
        modeValue="CUSTOM"
        currentMode={mode}
        onSelect={setMode}
      />
       <p className="text-xs text-slate-500 pt-2 text-center">
        You can always change your agent or settings later.
      </p>
    </div>
  );
} 