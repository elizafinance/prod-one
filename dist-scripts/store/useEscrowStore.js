import { create } from "zustand";
const useEscrowStore = create()((set) => ({
    escrow: undefined,
}));
export default useEscrowStore;
