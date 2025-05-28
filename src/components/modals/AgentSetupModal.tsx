"use client";

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { useAgentSetupStore } from '@/stores/agentSetupStore';
import AgentChoiceStep from './steps/AgentChoiceStep';
import AgentNameStep from './steps/AgentNameStep';
import EarningsShareStep from './steps/EarningsShareStep';
import TermsOfSymbiosisStep from './steps/TermsOfSymbiosisStep';
import DeployStep from './steps/DeployStep';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function AgentSetupModal() {
  const {
    isModalOpen,
    closeModal,
    currentStep,
    mode,
    nextStep,
    prevStep,
  } = useAgentSetupStore();

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <AgentChoiceStep />;
      case 2:
        if (mode === 'CUSTOM') {
          return <AgentNameStep />;
        } else {
          // Should not happen if logic in store is correct (skips to step 3 for DEFAULT)
          // For safety, if this state is reached, try to auto-advance.
          // It's better than showing a blank step or wrong step.
          setTimeout(() => nextStep(), 0); 
          return <div className='p-4 text-center text-slate-400'>Loading next step...</div>; // Placeholder content
        }
      case 3:
        return <EarningsShareStep />;
      case 4:
        return <TermsOfSymbiosisStep />;
      case 5:
        return <DeployStep />;
      default:
        return <div>Unknown Step</div>;
    }
  };

  // The Deploy step (5) is a distinct final action rather than part of the form steps.
  // const formSteps = mode === 'CUSTOM' ? 4 : 3; // Not directly used for now

  const getStepTitle = () => {
    if (currentStep === 1) return "Choose Your Companion";
    if (currentStep === 2 && mode === 'CUSTOM') return "Forge Your Agent";
    if (currentStep === 3) return "Symbiotic Share";
    if (currentStep === 4) return "Terms of Symbiosis";
    if (currentStep === 5) return "Agent Deployment";
    return "Agent Setup";
  };

  return (
    <Transition.Root show={isModalOpen} as={Fragment}>
      <Dialog as="div" className="relative z-[100]" onClose={closeModal}> {/* Increased z-index */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity" /> {/* Darker backdrop */}
        </Transition.Child>

        <div className="fixed inset-0 z-[100] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-xl bg-slate-900 text-slate-100 p-6 shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-sky-700/50">
                <div className="absolute top-0 right-0 pt-3 pr-3 z-10">
                  <button
                    type="button"
                    className="rounded-md bg-slate-800/80 p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                    onClick={closeModal}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <Dialog.Title as="h3" className="text-xl font-semibold leading-6 text-sky-400 mb-2 text-center">
                  {getStepTitle()}
                </Dialog.Title>
                <p className="text-center text-xs text-slate-400 mb-5">
                  Embark on a new era of collaboration with your AI counterpart.
                </p>
                
                <div className="min-h-[200px] sm:min-h-[220px]"> 
                  {renderStepContent()}
                </div>

                {currentStep < 5 && (
                  <div className={`mt-6 pt-4 border-t border-slate-700/70 flex ${currentStep === 1 || (mode === 'DEFAULT' && currentStep === 3) ? 'justify-end' : 'justify-between'} items-center`}>
                    {(currentStep > 1 && !(mode === 'DEFAULT' && currentStep === 3)) && (
                      <button
                        type="button"
                        onClick={prevStep}
                        className="rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-sky-400 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors"
                      >
                        &laquo; Back
                      </button>
                    )}
                    {/* The final action button for step 4 (TOS) is handled within TermsOfSymbiosisStep itself */}
                    {currentStep < 4 && (
                        <button
                        type="button"
                        onClick={nextStep} 
                        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:ring-offset-slate-900 transition-colors disabled:opacity-50"
                        >
                        Next &raquo;
                        </button>
                    )}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
} 