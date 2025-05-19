import { create } from "zustand";
const useTokenStore = create()((set) => ({
    tokenAccount: undefined,
    updateTokenAccount: (tokenAccount) => set({ tokenAccount }),
    tokenAsset: undefined,
    updateTokenAsset: (tokenAsset) => set({ tokenAsset }),
}));
export default useTokenStore;
