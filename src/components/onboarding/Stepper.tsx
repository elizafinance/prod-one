"use client";

import React from 'react';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { LockClosedIcon, WalletIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface StepProps {
  stepNumber: number;
  title: string;
  description: string;
  isCompleted: boolean;
  isActive: boolean;
  isFuture: boolean;
  icon: React.ElementType;
  actionButton?: React.ReactNode;
}

const Step: React.FC<StepProps> = ({ stepNumber, title, description, isCompleted, isActive, isFuture, icon: Icon, actionButton }) => {
  return (
    <div className={`flex items-start space-x-4 p-4 rounded-lg transition-all duration-300 ease-in-out 
      ${isActive ? 'bg-primary-foreground border border-primary/30 shadow-lg' : isCompleted ? 'bg-positive-subtle border border-positive/30' : 'bg-muted/50 border border-border'}
      ${isFuture ? 'opacity-60' : 'opacity-100'}
    `}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center 
        ${isCompleted ? 'bg-positive text-positive-foreground' : isActive ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/30 text-muted-foreground'}
      `}>
        {isCompleted ? <CheckCircleIcon className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
      </div>
      <div className="flex-grow">
        <h3 className={`text-lg font-semibold 
          ${isCompleted ? 'text-positive-emphasis' : isActive ? 'text-primary-emphasis' : 'text-foreground'}
        `}>{title}</h3>
        <p className={`text-sm 
          ${isCompleted ? 'text-positive' : isActive ? 'text-primary' : 'text-muted-foreground'}
        `}>{description}</p>
        {isActive && actionButton && (
          <div className="mt-3">
            {actionButton}
          </div>
        )}
      </div>
    </div>
  );
};

interface StepperProps {
  currentMajorStep: 'login' | 'wallet' | 'rewards_active';
  onLogin: () => void;
  onConnectWallet: () => void;
  isWalletConnected: boolean;
}

const OnboardingStepper: React.FC<StepperProps> = ({ currentMajorStep, onLogin, onConnectWallet, isWalletConnected }) => {
  const steps = [
    {
      id: 'login',
      title: "Step 1: Login with X",
      description: "Sign in with your X (Twitter) account to get started.",
      icon: LockClosedIcon,
      isCompleted: currentMajorStep === 'wallet' || currentMajorStep === 'rewards_active',
      isActive: currentMajorStep === 'login',
      actionButton: (
        <button
          onClick={onLogin}
          className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded-lg font-medium transition-colors text-sm"
        >
          Login with X
        </button>
      )
    },
    {
      id: 'wallet',
      title: "Step 2: Connect Your Wallet",
      description: isWalletConnected ? "Wallet connected! Proceeding to activate rewards." : "Connect your Solana wallet to link it to your rewards profile.",
      icon: WalletIcon,
      isCompleted: currentMajorStep === 'rewards_active',
      isActive: currentMajorStep === 'wallet',
      actionButton: !isWalletConnected ? (
        <button
          onClick={onConnectWallet}
          className="bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded-lg font-medium transition-colors text-sm"
        >
          Connect Wallet
        </button>
      ) : null
    },
    {
      id: 'rewards',
      title: "Step 3: Rewards Activated!",
      description: "You're all set! Start earning points and explore DeFAI Rewards.",
      icon: SparklesIcon,
      isCompleted: currentMajorStep === 'rewards_active',
      isActive: false,
    },
  ];

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {steps.map((step, index) => (
        <Step
          key={step.id}
          stepNumber={index + 1}
          title={step.title}
          description={step.description}
          isCompleted={step.isCompleted}
          isActive={step.isActive}
          isFuture={!step.isCompleted && !step.isActive}
          icon={step.icon}
          actionButton={step.actionButton}
        />
      ))}
    </div>
  );
};

export default OnboardingStepper; 