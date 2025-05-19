import { create } from 'zustand';
export const useCommunityQuestProgressStore = create((set) => ({
    communityQuestProgress: {},
    setCommunityQuestProgress: (progress) => set((state) => ({
        communityQuestProgress: Object.assign(Object.assign({}, state.communityQuestProgress), { [progress.questId]: progress }),
    })),
}));
export const useSquadQuestProgressStore = create((set) => ({
    squadQuestProgress: {},
    setSquadQuestProgress: (progress) => set((state) => {
        if (!progress.squadId) {
            console.warn('Attempted to set squad quest progress without squadId', progress);
            return state; // Do not update if squadId is missing
        }
        const existingSquadData = state.squadQuestProgress[progress.squadId] || {};
        return {
            squadQuestProgress: Object.assign(Object.assign({}, state.squadQuestProgress), { [progress.squadId]: Object.assign(Object.assign({}, existingSquadData), { [progress.questId]: progress }) }),
        };
    }),
}));
