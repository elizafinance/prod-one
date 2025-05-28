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
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import CrossmintLoginButton from '@/components/CrossmintLoginButton'; // Import the button
import DeFAILogo from '@/components/DeFAILogo'; // Assuming DeFAILogo is correctly located
import AgentSetupModal from '@/components/modals/AgentSetupModal'; // Path confirmed

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

const XIcon = () => (
  <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/squads", label: "Squads" },
  { href: "/squads/browse", label: "Squads Browse" },
  { href: "/proposals", label: "Proposals" },
  { href: "/yield", label: "Yield" },
  { href: "/myair", label: "My AIR" },
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
    fetchInitialUnreadCount: fetchInitialUnreadCountFromStore,
    isAgentSetupModalOpen, toggleAgentSetupModal
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
    ? session.user as (typeof session.user & { xId?: string | null, image?: string | null, name?: string | null }) 
    : null;

  // If still loading auth status or not client yet, render a placeholder or null to prevent hydration mismatch
  if (authStatus === 'loading' || !isClient) {
    return (
      <header className="sticky top-0 z-50 w-full bg-white shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-2">
                <DeFAILogo className="h-8 w-auto" textClassName="text-xl" />
              </Link>
            </div>
            <div className="h-8 w-24 bg-slate-700 animate-pulse rounded-md"></div> {/* Placeholder for button area */}
          </div>
        </div>
      </header>
    );
  }
  
  return (
    <header className="sticky top-0 z-50 w-full bg-white shadow-md">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo and Nav Links */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <DeFAILogo className="h-8 w-auto" textClassName="text-xl" />
            </Link>
            {/* Desktop Nav Links - Show if authenticated */}
            {isClient && authStatus === "authenticated" && (
              <nav className="hidden md:flex md:items-center md:space-x-4 md:ml-6">
                <Link href="/" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Dashboard</Link>
                <Link href="/quests" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Quests</Link>
                <Link href="/squads" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Squads</Link>
                {/* <Link href="/leaderboard" className="text-sm font-medium text-slate-300 hover:text-white transition-colors">Leaderboard</Link> */}
              </nav>
            )}
          </div>

          {/* Right side: Wallet Connector / Profile */}
          <div className="flex items-center">
            {isClient && authStatus !== "authenticated" && (
              // Replace X login button with CrossmintLoginButton
              // Apply similar styling or wrap it if needed to match the X button
              <div className="ml-2">
                <CrossmintLoginButton />
              </div>
            )}

            {/* User Avatar/Profile Button - Show if X authenticated and on client */}
            {/* This part regarding 'typedUser' and 'signOut' will need to adapt to the new cookie auth */}
            {isClient && authStatus === "authenticated" && typedUser && (
              <>
                {/* Wallet Multi Button - Show if authenticated and on client */}
                <WalletMultiButtonDynamic style={{ height: '36px', borderRadius: '9999px', backgroundColor: '#3B82F6', fontSize: '0.875rem' }} />
                
                {/* Notification Bell - Show if authenticated and on client */}
                <button 
                  onClick={handleOpenNotifications} 
                  className="ml-2 p-1.5 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-white relative transition-colors"
                >
                  <BellIcon className="h-5 w-5" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-1 ring-slate-800" />
                  )}
                </button>

                <UserAvatar 
                  profileImageUrl={typedUser.image} // This will need to come from the new auth/user object
                  username={typedUser.name || typedUser.xId || 'User'} // Same as above
                />
                <button 
                  onClick={() => signOut()} // signOut will need to be adapted for cookie removal
                  className="ml-2 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals and Panels */}
      {isClient && isAgentSetupModalOpen && <AgentSetupModal />}

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