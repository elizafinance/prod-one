import { create } from 'zustand';
const initialState = {
    mode: 'DEFAULT',
    name: 'DeFAIZA', // Default agent name
    sharePercent: 10, // Default share
    tosAccepted: false,
    currentStep: 1,
    isModalOpen: false,
};
export const useAgentSetupStore = create()((set, get) => (Object.assign(Object.assign({}, initialState), { setMode: (mode) => set(() => {
        if (mode === 'DEFAULT') {
            const newStep = get().currentStep === 2 ? 3 : (get().currentStep > 2 ? get().currentStep : 1);
            return { mode, name: 'DeFAIZA', currentStep: newStep };
        }
        else {
            const newStep = get().currentStep === 1 ? 2 : get().currentStep;
            return { mode, name: 'My Symbiote', currentStep: newStep };
        }
    }), setName: (name) => set({ name }), setSharePercent: (percent) => set({ sharePercent: percent }), setTosAccepted: (accepted) => set({ tosAccepted: accepted }), setCurrentStep: (step) => set({ currentStep: step }), nextStep: () => set((state) => {
        let next = state.currentStep + 1;
        if (state.mode === 'DEFAULT' && state.currentStep === 1) {
            next = 3;
        }
        if (state.mode === 'CUSTOM' && state.currentStep === 2 && state.name.trim().length < 1) {
            return {};
        }
        return { currentStep: Math.min(next, 5) };
    }), prevStep: () => set((state) => {
        let prev = state.currentStep - 1;
        if (state.mode === 'DEFAULT' && state.currentStep === 3) {
            prev = 1;
        }
        return { currentStep: Math.max(prev, 1) };
    }), openModal: () => set(Object.assign(Object.assign({}, initialState), { isModalOpen: true, name: 'DeFAIZA', mode: 'DEFAULT' })), closeModal: () => set({ isModalOpen: false }), reset: () => set((state) => {
        const tempInitialState = Object.assign({}, initialState);
        delete tempInitialState.isModalOpen;
        return Object.assign(Object.assign({}, tempInitialState), { isModalOpen: state.isModalOpen, name: 'DeFAIZA', mode: 'DEFAULT' });
    }) })));
