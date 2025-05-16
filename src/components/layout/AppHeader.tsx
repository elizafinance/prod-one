"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteLogo from "@/assets/logos/favicon.ico"; // Adjust path if needed
import { useSession, signIn, signOut } from "next-auth/react";
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { BellIcon } from '@heroicons/react/24/outline'; // Ensure this is installed
import useUiStateStore from '@/store/useUiStateStore'; // Import the new UI state store
import NotificationsPanel from '@/components/notifications/NotificationsPanel'; // Adjust path
import { toast } from 'sonner'; // Correct import for toast
import AppNav, { NavItem } from './AppNav'; // Import the new AppNav and NavItem type
import UserAvatar from "@/components/UserAvatar"; // Assuming you have this for profile

// Dynamically import WalletMultiButton (if used in header)
const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

const XIcon = () => <span>✖️</span>; // Placeholder, replace with actual Icon if available

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/squads/my", label: "My Squad" },
  { href: "/squads/browse", label: "Squads Browse" },
  { href: "/proposals", label: "Proposals" },
  // The Airdrop Checker is part of the Dashboard page, so no separate nav item usually needed
  // If it were a distinct page: { href: "/airdrop-checker", label: "Airdrop Checker" },
];

export default function AppHeader() {
  const { data: session, status: authStatus } = useSession();
  const { connected, publicKey } = useWallet();
  const [notificationsInitialized, setNotificationsInitialized] = useState(false);

  const isNotificationsPanelOpen = useUiStateStore((state) => state.isNotificationsPanelOpen);
  const unreadNotificationCount = useUiStateStore((state) => state.unreadNotificationCount);
  const toggleNotificationsPanel = useUiStateStore((state) => state.toggleNotificationsPanel);
  const setUnreadNotificationCountInStore = useUiStateStore((state) => state.setUnreadNotificationCount);
  const fetchInitialUnreadCount = useUiStateStore((state) => state.fetchInitialUnreadCount);

  useEffect(() => {
    // Fetch initial unread count when user is authenticated and wallet connected
    if (authStatus === "authenticated" && connected && publicKey) {
      console.log('[AppHeader] Initializing notifications for:', publicKey.toBase58());
      try {
        fetchInitialUnreadCount(publicKey.toBase58(), true)
          .then(() => {
            console.log('[AppHeader] Notifications initialized successfully');
            setNotificationsInitialized(true);
          })
          .catch((error) => {
            console.error('[AppHeader] Error initializing notifications:', error);
            setNotificationsInitialized(false);
          });
      } catch (error) {
        console.error('[AppHeader] Failed to initialize notifications:', error);
      }
    } else {
      // Reset unread count if user logs out or disconnects wallet
      console.log('[AppHeader] Resetting notifications - auth:', authStatus, 'connected:', connected);
      setUnreadNotificationCountInStore(0);
      setNotificationsInitialized(false);
    }
  }, [authStatus, connected, publicKey, fetchInitialUnreadCount, setUnreadNotificationCountInStore]);

  const handleOpenNotifications = () => {
    if (!connected || authStatus !== "authenticated") {
      // Show a prompt via console (you can expand this to a UI prompt) 
      console.warn('[AppHeader] Cannot open notifications - user not authenticated or wallet not connected');
      toast.info("Please log in with X and connect your wallet to view notifications."); // User-facing toast
      return;
    }
    toggleNotificationsPanel();
  };

  return (
    <header className="w-full bg-background/80 backdrop-blur-md shadow-sm sticky top-0 z-40 border-b border-border">
      {/* END DEBUG INFO */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          <div className="flex items-center">
            <Link href="/" className="flex items-center text-decoration-none">
              <span 
                style={{ color: '#2A97F1', fontSize: '1.5rem', fontWeight: 'bold' }} 
              >
                DEFAI
              </span>
            </Link>
          </div>
          <div className="flex-1 min-w-0 ml-6">
            <AppNav navItems={navItems} />
          </div>
          <div className="flex items-center space-x-2 sm:space-x-3 ml-auto">
            {authStatus === "authenticated" && connected && (
              <button 
                onClick={handleOpenNotifications} 
                className="relative p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none transition-colors"
                aria-label="View notifications"
              >
                <BellIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 block h-3 w-3 sm:h-4 sm:w-4 transform -translate-y-1/2 translate-x-1/2 rounded-full bg-red-500 text-white text-[8px] sm:text-xs flex items-center justify-center shadow-solid">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>
            )}

            <WalletMultiButtonDynamic 
              style={{
                backgroundColor: '#2B96F1', 
                color: 'white', 
                borderRadius: '9999px', 
                paddingLeft: '12px', 
                paddingRight: '12px', 
                fontSize: '0.875rem', 
                height: '36px'
              }}
            />

            {authStatus !== "authenticated" && (
              <button
                onClick={() => signIn('twitter')}
                className="px-3 py-1.5 bg-[#1DA1F2] hover:bg-[#1A8CD8] text-white rounded-full flex items-center space-x-1 text-sm transition-colors duration-150"
              >
                <XIcon />
                <span className="hidden sm:inline">Login</span>
              </button>
            )}

            {authStatus === "authenticated" && session?.user?.xProfileImageUrl && (
              <UserAvatar 
                profileImageUrl={session.user.xProfileImageUrl} 
                username={session.user.xUsername || session.user.name} 
                size="sm"
              />
            )}
          </div>
        </div>
      </div>

      {/* Render Notifications Panel globally, controlled by Zustand state */}
      <NotificationsPanel 
        isOpen={isNotificationsPanelOpen} 
        onClose={toggleNotificationsPanel} // Or a dedicated closePanel action if preferred
        onUpdateUnreadCount={setUnreadNotificationCountInStore} 
      />
    </header>
  );
} 