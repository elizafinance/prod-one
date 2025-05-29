import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Define OnboardingStep type (can be imported from AgentOnboardingFlow if preferred)
export type OnboardingStep =
  | "WELCOME"
  | "CONNECT_WALLET"
  | "STAKE"
  | "DEPLOY_AGENT"
  | "SET_RISK"
  | "DONE";

interface OnboardingState {
  step: OnboardingStep;
  riskTolerance: number; // Added from AgentOnboardingFlow local state
  setStep: (step: OnboardingStep) => void;
  setRiskTolerance: (tolerance: number) => void;
  resetOnboarding: () => void; // Utility to reset for testing
}

const getInitialStep = (): OnboardingStep => {
  if (typeof window !== 'undefined') {
    const completed = localStorage.getItem('defai_onboard_complete');
    if (completed === 'true') {
      return "DONE";
    }
  }
  return "WELCOME";
};

export const useOnboardingStore = create<OnboardingState>()(
  // Persist only the 'step' and 'riskTolerance' to localStorage.
  // Don't persist functions.
  persist(
    (set) => ({
      step: getInitialStep(), // Initialize step based on localStorage
      riskTolerance: 3, // Default risk tolerance
      setStep: (step) => {
        set({ step });
        if (step === "DONE" && typeof window !== 'undefined') {
          localStorage.setItem('defai_onboard_complete', 'true');
        }
      },
      setRiskTolerance: (tolerance) => set({ riskTolerance: tolerance }),
      resetOnboarding: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('defai_onboard_complete');
        }
        set({ step: "WELCOME", riskTolerance: 3 });
      },
    }),
    {
      name: 'defai-onboarding-storage', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
      partialize: (state) => ({ step: state.step, riskTolerance: state.riskTolerance }), // Only persist step and riskTolerance
    }
  )
); 