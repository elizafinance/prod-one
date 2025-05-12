"use client";

import { useEffect } from 'react';
import Link from 'next/link';
import SiteLogo from "@/assets/logos/favicon.ico"; // Adjust path if needed
import { useSession, signIn, signOut } from "next-auth/react";
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { BellIcon } from '@heroicons/react/24/outline'; // Ensure this is installed
import useUiStateStore from '@/store/useUiStateStore'; // Import the new UI state store
import NotificationsPanel from '@/components/notifications/NotificationsPanel'; // Adjust path

// Dynamically import WalletMultiButton (if used in header)
const WalletMultiButtonDynamic = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

const XIcon = () => <span>✖️</span>; // Placeholder, replace with actual Icon if available

export default function AppHeader() {
  const { data: session, status: authStatus } = useSession();
  const { connected, publicKey } = useWallet();

  const isNotificationsPanelOpen = useUiStateStore((state) => state.isNotificationsPanelOpen);
  const unreadNotificationCount = useUiStateStore((state) => state.unreadNotificationCount);
  const toggleNotificationsPanel = useUiStateStore((state) => state.toggleNotificationsPanel);
  const setUnreadNotificationCountInStore = useUiStateStore((state) => state.setUnreadNotificationCount);
  const fetchInitialUnreadCount = useUiStateStore((state) => state.fetchInitialUnreadCount);

  useEffect(() => {
    // Fetch initial unread count when user is authenticated and wallet connected
    if (authStatus === "authenticated" && connected && publicKey) {
      fetchInitialUnreadCount(publicKey.toBase58(), true);
    } else {
      // Reset unread count if user logs out or disconnects wallet
      setUnreadNotificationCountInStore(0);
    }
  }, [authStatus, connected, publicKey, fetchInitialUnreadCount, setUnreadNotificationCountInStore]);

  return (
    <header className="w-full bg-white dark:bg-gray-900/80 backdrop-blur-md shadow-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" passHref>
              <img 
                className="h-8 sm:h-10 cursor-pointer"
                src={SiteLogo.src} 
                alt="DeFAI Rewards Logo" 
              />
            </Link>
          </div>

          {/* Right side: Notification Bell, Wallet Button, Auth Button */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {authStatus === "authenticated" && connected && (
              <button 
                onClick={toggleNotificationsPanel} 
                className="relative p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-indigo-500 transition-colors"
                aria-label="View notifications"
              >
                <BellIcon className="h-6 w-6" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-0 right-0 block h-4 w-4 transform -translate-y-1/2 translate-x-1/2 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow-solid">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>
                )}
              </button>
            )}

            <WalletMultiButtonDynamic style={{ height: '38px', fontSize: '0.875rem' }} />

            {authStatus === "authenticated" && session?.user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="hidden sm:inline text-sm text-gray-700 dark:text-gray-300">Hi, {session.user.name || session.user.xUsername || session.user.xId}</span>
                <button 
                  onClick={() => signOut()} 
                  className="py-1.5 px-3 text-xs sm:text-sm bg-red-500 hover:bg-red-600 text-white font-semibold rounded-md transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button 
                onClick={() => signIn('twitter')} 
                className="py-1.5 px-3 sm:px-4 text-xs sm:text-sm bg-[#1DA1F2] hover:bg-[#0c85d0] text-white font-semibold rounded-md transition-colors flex items-center gap-1 sm:gap-2"
              >
                <XIcon /> Log in with X
              </button>
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