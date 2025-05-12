import { create } from 'zustand';
import { NotificationDocument } from '@/lib/mongodb'; // For potential future use if store manages notifs directly

interface UiState {
  isNotificationsPanelOpen: boolean;
  unreadNotificationCount: number;
  toggleNotificationsPanel: () => void;
  setUnreadNotificationCount: (count: number) => void;
  fetchInitialUnreadCount: (walletAddress: string | null | undefined, isUserAuthenticated: boolean) => Promise<void>; // Pass walletAddress & auth status
  // Potentially add notifications array here in the future if panel should not fetch on every open
}

const useUiStateStore = create<UiState>()((set, get) => ({
  isNotificationsPanelOpen: false,
  unreadNotificationCount: 0,
  toggleNotificationsPanel: () => set((state) => ({ isNotificationsPanelOpen: !state.isNotificationsPanelOpen })),
  setUnreadNotificationCount: (count: number) => set({ unreadNotificationCount: count }),
  fetchInitialUnreadCount: async (walletAddress, isUserAuthenticated) => {
    if (!isUserAuthenticated || !walletAddress) {
      // console.log("[UI Store] Not fetching unread count: user not authenticated or no wallet address.");
      set({ unreadNotificationCount: 0 }); // Reset if not auth or no wallet
      return;
    }
    // console.log("[UI Store] Fetching initial unread count for:", walletAddress);
    try {
      // The API needs to be called by an authenticated user, session is handled by NextAuth on the backend.
      const response = await fetch('/api/notifications/my-notifications?limit=1&unread=true');
      if (response.ok) {
        const data = await response.json();
        set({ unreadNotificationCount: data.unreadCount || 0 });
      } else {
        console.error("[UI Store] Failed to fetch initial unread count, API error:", response.statusText);
        set({ unreadNotificationCount: 0 }); // Reset on error
      }
    } catch (error) {
      console.error("[UI Store] Error fetching initial unread count:", error);
      set({ unreadNotificationCount: 0 }); // Reset on error
    }
  },
}));

export default useUiStateStore; 