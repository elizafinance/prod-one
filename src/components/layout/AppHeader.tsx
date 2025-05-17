"use client";

import { useEffect, useState, useCallback, ComponentProps } from 'react';
import Link from 'next/link';
import { useSession, signIn, signOut } from "next-auth/react";
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { BellIcon } from '@heroicons/react/24/outline'; // Ensure this is installed
import useUiStateStore from '@/store/useUiStateStore'; // Import the new UI state store
import NotificationsPanel from '@/components/notifications/NotificationsPanel'; // Adjusted path and import props
import { toast } from 'sonner'; // Correct import for toast
import AppNav, { NavItem } from './AppNav'; // Import the new AppNav and NavItem type
import UserAvatar from "@/components/UserAvatar"; // Assuming UserAvatarProps is exported

// Type imports using ComponentProps for better robustness if props are not explicitly exported
// This assumes NotificationsPanel and UserAvatar are functional or class components.
// If they are forwardRef components, a different approach might be needed for types.
// type NotificationsPanelProps = ComponentProps<typeof NotificationsPanel>;
// type UserAvatarProps = ComponentProps<typeof UserAvatar>;

// Dynamically import WalletMultiButton (if used in header)
const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

const XIcon = () => <span>✖️</span>; // TODO: Replace with a proper X icon

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/squads/my", label: "My Squad" },
  { href: "/squads/browse", label: "Squads Browse" },
  { href: "/proposals", label: "Proposals" },
  { href: "/yield", label: "Yield" },
  // The Airdrop Checker is part of the Dashboard page, so no separate nav item usually needed
  // If it were a distinct page: { href: "/airdrop-checker", label: "Airdrop Checker" },
];

export default function AppHeader() {
  const { data: session, status: authStatus } = useSession(); // Rely on next-auth.d.ts for session type
  const { wallet, connected, publicKey, select } = useWallet();
  const [isClient, setIsClient] = useState(false);
  const { 
    isNotificationsPanelOpen, 
    toggleNotificationsPanel, 
    unreadNotificationCount, 
    setUnreadNotificationCount: setUnreadNotificationCountInStore,
    fetchInitialUnreadCount: fetchInitialUnreadCountFromStore // Renamed to avoid conflict
  } = useUiStateStore();
  const [notificationsInitialized, setNotificationsInitialized] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Moved fetchInitialUnreadCount outside of useEffect dependency array issues
  const fetchNotificationsData = useCallback(async () => {
    if (authStatus === "authenticated" && connected && publicKey && !notificationsInitialized) {
      console.log('[AppHeader] Initializing notifications for:', publicKey.toBase58());
      try {
        await fetchInitialUnreadCountFromStore(publicKey.toBase58(), true);
        console.log('[AppHeader] Notifications initialized successfully via store action');
        setNotificationsInitialized(true);
      } catch (error: any) {
        console.error('[AppHeader] Error initializing notifications via store action:', error);
        setNotificationsInitialized(false); 
      }
    }
  }, [authStatus, connected, publicKey, fetchInitialUnreadCountFromStore, notificationsInitialized]);

  useEffect(() => {
    fetchNotificationsData();
  }, [fetchNotificationsData]);

  useEffect(() => {
    if (authStatus !== "authenticated" || !connected) {
      console.log('[AppHeader] Resetting notifications - auth:', authStatus, 'connected:', connected);
      setUnreadNotificationCountInStore(0);
      setNotificationsInitialized(false);
    }
  }, [authStatus, connected, setUnreadNotificationCountInStore]);

  const handleOpenNotifications = () => {
    if (!connected || authStatus !== "authenticated") {
      // Show a prompt via console (you can expand this to a UI prompt) 
      console.warn('[AppHeader] Cannot open notifications - user not authenticated or wallet not connected');
      toast.info("Please log in with X and connect your wallet to view notifications."); // User-facing toast
      return;
    }
    toggleNotificationsPanel();
  };

  // Safely define typedUser only if session and session.user exist
  const typedUser = session && session.user 
    ? session.user as (typeof session.user & { xId?: string | null }) 
    : null;

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
            {/* WalletMultiButton: Show only if X is authenticated AND WALLET NOT CONNECTED YET, and on client */}
            {isClient && authStatus === "authenticated" && !connected && (
              <WalletMultiButtonDynamic 
                className="ml-2"
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
            )}

            {/* X Login Button: Show only if not X authenticated and on client */}
            {isClient && authStatus !== "authenticated" && (
              <button
                onClick={() => signIn('twitter')}
                className="ml-2 flex items-center space-x-1 hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: '#2B96F1', // Or black: '#000000'
                  color: 'white',
                  borderRadius: '9999px',
                  paddingLeft: '12px',
                  paddingRight: '12px',
                  fontSize: '0.875rem',
                  height: '36px'
                }}
              >
                <XIcon />
                <span className="hidden sm:inline">Login with X</span>
              </button>
            )}

            {/* User Avatar/Profile Button - Show if X authenticated and on client */}
            {/* Note: session.user should be typed by next-auth.d.ts */}
            {isClient && authStatus === "authenticated" && typedUser && (
              <>
                <UserAvatar 
                  profileImageUrl={typedUser.image}
                  username={typedUser.name || typedUser.xId || 'User'}
                />
                <button 
                  onClick={() => signOut()} 
                  className="ml-2 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                >
                  Sign Out
                </button>
              </>
            )}

            {/* Notifications Bell - Show if X authenticated, wallet connected, and on client */}
            {isClient && authStatus === "authenticated" && connected && (
              <button 
                onClick={handleOpenNotifications} 
                className="ml-3 p-1 rounded-full text-gray-700 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 relative"
              >
                <span className="sr-only">View notifications</span>
                <BellIcon className="h-6 w-6" aria-hidden="true" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-0 right-0 block h-2 w-2 transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full"></span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Render Notifications Panel globally, controlled by Zustand state */}
      {/* Show if X authenticated, wallet connected, panel open, and on client */}
      {isClient && isNotificationsPanelOpen && authStatus === "authenticated" && connected && (
        <NotificationsPanel 
          isOpen={isNotificationsPanelOpen} 
          onClose={toggleNotificationsPanel} 
          onUpdateUnreadCount={setUnreadNotificationCountInStore}
        />
      )}
    </header>
  );
} 