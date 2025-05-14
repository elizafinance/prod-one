"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession, signIn, signOut } from "next-auth/react";
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { BellIcon } from '@heroicons/react/24/outline'; // Ensure this is installed
import useUiStateStore from '@/store/useUiStateStore'; // Import the new UI state store
import NotificationsPanel from '@/components/notifications/NotificationsPanel'; // Adjust path
import { toast } from 'sonner'; // Correct import for toast
// Dynamically import WalletMultiButton (if used in header)
const WalletMultiButtonDynamic = dynamic(async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton, { ssr: false });
const XIcon = () => <span>✖️</span>; // Placeholder, replace with actual Icon if available
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
            }
            catch (error) {
                console.error('[AppHeader] Failed to initialize notifications:', error);
            }
        }
        else {
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
    return (<header className="w-full bg-white backdrop-blur-md shadow-sm sticky top-0 z-30">
      {/* DEBUG INFO - REMOVE IN PRODUCTION */}
      <div style={{ position: 'fixed', top: '64px', left: '10px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '5px', fontSize: '10px', zIndex: 9999 }}>
        <p>Auth: {authStatus}</p>
        <p>Session User: {session?.user?.xId || session?.user?.name || 'No session user'}</p>
        <p>Wallet Connected: {connected ? 'Yes' : 'No'}</p>
        <p>Wallet PK: {publicKey?.toBase58() || 'N/A'}</p>
        <p>Unread Count: {unreadNotificationCount}</p>
      </div>
      {/* END DEBUG INFO */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" passHref>
              <div className="text-[#2B96F1] font-semibold text-3xl cursor-pointer">
                defAI.
              </div>
            </Link>
          </div>

          {/* Right side: Notification Bell, Wallet Button, Auth Button */}
          <div className="flex items-center space-x-3 sm:space-x-4">
            {authStatus === "authenticated" && connected && (<button onClick={handleOpenNotifications} className="relative p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800 focus:ring-indigo-500 transition-colors" aria-label="View notifications">
                <BellIcon className="h-6 w-6"/>
                {unreadNotificationCount > 0 && (<span className="absolute top-0 right-0 block h-4 w-4 transform -translate-y-1/2 translate-x-1/2 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow-solid">
                    {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                  </span>)}
              </button>)}

            {/* Revert to using style prop for better control */}
            {/* <WalletMultiButtonDynamic className="bg-[#2B96F1] hover:bg-blue-700 text-white font-medium py-1.5 px-4 rounded-full text-sm transition-colors" /> */}
            <WalletMultiButtonDynamic style={{
            backgroundColor: '#2B96F1',
            color: 'white',
            borderRadius: '9999px', // Fully rounded
            paddingLeft: '16px', // px-4
            paddingRight: '16px', // px-4
            fontSize: '0.875rem', // text-sm
            lineHeight: '1.25rem',
            fontWeight: 500, // font-medium
            height: '36px' // Explicit height h-9
        }}/>

            {authStatus === "authenticated" && session?.user ? (<div className="flex items-center gap-2 sm:gap-3">
                <span className="hidden sm:inline text-sm text-gray-700 dark:text-gray-300">Hi, {session.user.name || session.user.xUsername || session.user.xId}</span>
                <button onClick={() => signOut()} className="py-1.5 px-3 text-xs sm:text-sm bg-red-500 hover:bg-red-600 text-white font-semibold rounded-md transition-colors h-9" // Added h-9
        >
                  Sign Out
                </button>
              </div>) : (<button onClick={() => signIn('twitter')} className="bg-[#2B96F1] hover:bg-blue-700 text-white font-medium px-4 rounded-full text-sm transition-colors flex items-center gap-2 h-9" // Added h-9, removed py-1.5 (height handles vertical) 
        >
                <XIcon /> Log in with X
              </button>)}
          </div>
        </div>
      </div>

      {/* Render Notifications Panel globally, controlled by Zustand state */}
      <NotificationsPanel isOpen={isNotificationsPanelOpen} onClose={toggleNotificationsPanel} // Or a dedicated closePanel action if preferred
     onUpdateUnreadCount={setUnreadNotificationCountInStore}/>
    </header>);
}
