import { create } from 'zustand';

export interface QuestProgressData {
  questId: string;
  questTitle?: string;
  currentProgress: number;
  goalTarget: number;
  scope: 'community' | 'squad';
  squadId?: string; // Only present if scope is 'squad'
  lastContributorWalletAddress?: string; // For community scope
  updatedAt: string;
}

interface CommunityQuestProgressState {
  communityQuestProgress: Record<string, QuestProgressData>; // Keyed by questId
  setCommunityQuestProgress: (progress: QuestProgressData) => void;
}

export const useCommunityQuestProgressStore = create<CommunityQuestProgressState>((set) => ({
  communityQuestProgress: {},
  setCommunityQuestProgress: (progress) =>
    set((state) => ({
      communityQuestProgress: {
        ...state.communityQuestProgress,
        [progress.questId]: progress,
      },
    })),
}));

interface SquadQuestProgressState {
  squadQuestProgress: Record<string, Record<string, QuestProgressData>>; // Keyed by squadId, then questId
  setSquadQuestProgress: (progress: QuestProgressData) => void;
}

export const useSquadQuestProgressStore = create<SquadQuestProgressState>((set) => ({
  squadQuestProgress: {},
  setSquadQuestProgress: (progress) =>
    set((state) => {
      if (!progress.squadId) {
        console.warn('Attempted to set squad quest progress without squadId', progress);
        return state; // Do not update if squadId is missing
      }
      const existingSquadData = state.squadQuestProgress[progress.squadId] || {};
      return {
        squadQuestProgress: {
          ...state.squadQuestProgress,
          [progress.squadId]: {
            ...existingSquadData,
            [progress.questId]: progress,
          },
        },
      };
    }),
})); 