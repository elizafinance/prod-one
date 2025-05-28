"use client";
import { useAgentSetupStore } from '@/stores/agentSetupStore';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

const funPhrases = [
  "Negotiating quantum contract…",
  "Spinning up Solana validators…", 
  "Uploading neural heuristics…",
  "Final handshake with Crossmint…",
  "Calibrating symbiotic frequencies...",
  "Assembling nanobots...",
  "Initializing digital consciousness...",
  "Bridging human-AI matrix..."
];

export default function DeployStep() {
  const { name, closeModal, sharePercent, mode: agentMode } = useAgentSetupStore();
  const { data: session, update: updateSession } = useSession();
  
  const [deploymentStatus, setDeploymentStatus] = useState<'PENDING' | 'DEPLOYING' | 'SUCCESS' | 'FAILED'>('PENDING');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [agentUrl, setAgentUrl] = useState<string | null>(null);
  const [currentPhrase, setCurrentPhrase] = useState(funPhrases[0]);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    let phraseInterval: NodeJS.Timeout;
    if (deploymentStatus === 'DEPLOYING') {
      phraseInterval = setInterval(() => {
        setCurrentPhrase(funPhrases[Math.floor(Math.random() * funPhrases.length)]);
      }, 3000); 
    }
    return () => clearInterval(phraseInterval);
  }, [deploymentStatus]);
  
  useEffect(() => {
    const deploy = async () => {
      if (deploymentStatus !== 'PENDING') return;

      setDeploymentStatus('DEPLOYING');
      setErrorMessage(null);

      try {
        if (!session?.user?.dbId) { 
            setErrorMessage("User session is invalid or missing critical data. Please log out and back in.");
            setDeploymentStatus('FAILED');
            setShowButton(true);
            return;
        }
        
        const agentDetails = {
            agentName: name, 
            agentType: agentMode === 'DEFAULT' ? 'DeFAIZA_v1' : 'CUSTOM_v1', 
            sharePercent: sharePercent,
        };

        const response = await fetch('/api/agents/deploy', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(agentDetails) 
        });
        const data = await response.json();

        if (response.ok && data.success) {
          setDeploymentStatus('SUCCESS');
          setAgentUrl(data.agentUrl || null);
          await updateSession(); 
          setTimeout(() => setShowButton(true), 1500); 
        } else {
          setErrorMessage(data.error || "An unknown error occurred during deployment.");
          setDeploymentStatus('FAILED');
          setShowButton(true);
        }
      } catch (error: any) {
        setErrorMessage(error.message || "Network error or server unreachable.");
        setDeploymentStatus('FAILED');
        setShowButton(true);
      }
    };

    setTimeout(deploy, 500); 
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Deploy effect should run once

  const handleFinish = () => {
    closeModal();
  };

  const agentDisplayName = name || "Your Agent";

  return (
    <div className="py-8 flex flex-col items-center justify-center text-center min-h-[200px] sm:min-h-[220px]">
      {deploymentStatus === 'DEPLOYING' && (
        <>
          <ArrowPathIcon className="h-12 w-12 text-sky-400 animate-spin mb-4" />
          <p className="text-lg font-semibold text-sky-300">Establishing Symbiosis with {agentDisplayName}...</p>
          <p className="text-sm text-slate-400 mt-2 animate-pulse">{currentPhrase}</p>
        </>
      )}
      {deploymentStatus === 'SUCCESS' && (
        <>
          <CheckCircleIcon className="h-16 w-16 text-green-500 mb-3" />
          <p className="text-xl font-bold text-green-400">Symbiosis Established!</p>
          <p className="text-slate-300 mt-1">
            Welcome to the future, partner. {agentDisplayName} is now active.
          </p>
          {agentUrl && (
            <p className="text-xs text-slate-400 mt-2">
              Agent Interface: <a href={agentUrl} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">{agentUrl}</a>
            </p>
          )}
           {showButton && (
            <button 
                onClick={handleFinish}
                className="mt-8 rounded-md bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-opacity duration-500 opacity-100"
            >
                Go to Dashboard
            </button>
          )}
        </>
      )}
      {deploymentStatus === 'FAILED' && (
        <>
          <ExclamationCircleIcon className="h-16 w-16 text-red-500 mb-3" />
          <p className="text-xl font-bold text-red-400">Deployment Failed</p>
          <p className="text-slate-300 mt-1 max-w-xs mx-auto">{errorMessage || "An unexpected error occurred."}</p>
          {showButton && (
             <button 
                onClick={closeModal} 
                className="mt-8 rounded-md border border-slate-600 bg-slate-700 px-6 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-opacity duration-500 opacity-100"
            >
                Close & Review
            </button>
          )}
        </>
      )}
    </div>
  );
} 