"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSession, signOut as nextAuthSignOut } from "next-auth/react";
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
import { useRouter } from 'next/navigation'; // For redirection

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
  { href: "/quests", label: "Quests" },
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
  const { wallet, connected, publicKey, select, disconnect } = useWallet();
  const router = useRouter(); // Initialize router
  const [isClient, setIsClient] = useState(false);
  const uiState = useUiStateStore(); // Get the whole store or specific items
  const prevConnectedRef = useRef<boolean | undefined>(undefined); // For disconnect watcher

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Temporary log for session data
  /* // Commenting out the multi-line debug block
  useEffect(() => {
    if (session?.user) {
      console.log("[AppHeader DEBUG] session.user:", JSON.stringify(session.user, null, 2));
      const user = session.user as any; 
      console.log("[AppHeader DEBUG] session.user.linkedXProfileImageUrl:", user.linkedXProfileImageUrl);
      console.log("[AppHeader DEBUG] session.user.image (original/fallback):", user.image);
    }
  }, [session]);
  */

  // Simplified effect for fetching initial unread count
  const walletAddress = session?.user?.walletAddress; // Extract walletAddress

  useEffect(() => {
    console.log(`[AppHeader Effect] authStatus: ${authStatus}, connected: ${connected}, walletAddress: ${walletAddress}`); // Keep this log for now
    if (authStatus === 'authenticated' && connected && walletAddress) {
        uiState.fetchInitialUnreadCount(walletAddress, true);
    } else if (authStatus !== 'loading') { 
        uiState.setUnreadNotificationCount(0); 
    }
  }, [authStatus, connected, walletAddress, uiState.fetchInitialUnreadCount, uiState.setUnreadNotificationCount]);

  // SSE Connection Management
  useEffect(() => {
    let eventSource: EventSource | null = null;

    if (authStatus === 'authenticated' && connected && walletAddress) {
      console.log('[AppHeader SSE] Establishing SSE connection...');
      eventSource = new EventSource('/api/notifications/subscribe');

      eventSource.onopen = () => {
        console.log('[AppHeader SSE] Connection opened.');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // console.log('[AppHeader SSE] Message received:', data);
          if (data.type === 'unread_count_update') {
            // console.log('[AppHeader SSE] Received unread_count_update:', data.count);
            uiState.setUnreadNotificationCount(data.count);
          } else if (data.type === 'heartbeat') {
            // console.log('[AppHeader SSE] Heartbeat received');
          }
        } catch (error) {
          console.error('[AppHeader SSE] Error parsing message data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[AppHeader SSE] Connection error:', error);
        // EventSource will attempt to reconnect automatically on some errors.
        // For critical errors, or if it closes, it might need to be explicitly handled.
        if (eventSource?.readyState === EventSource.CLOSED) {
            console.log('[AppHeader SSE] Connection was closed.');
            // Optionally attempt to re-establish connection here after a delay, or rely on next effect run.
        }
      };
    } else {
      console.log('[AppHeader SSE] Conditions not met for SSE, or cleaning up previous connection.');
    }

    return () => {
      if (eventSource) {
        console.log('[AppHeader SSE] Closing SSE connection.');
        eventSource.close();
      }
    };
  }, [authStatus, connected, walletAddress, uiState.setUnreadNotificationCount]); // Add uiState.setUnreadNotificationCount to deps

  // Global Disconnect Watcher Effect (moved from useHomePageLogic)
  useEffect(() => {
    // console.log(`[AppHeader Disconnect Watcher] Running. Wallet Connected: ${connected}, Auth Status: ${authStatus}`);
    if (prevConnectedRef.current === true && !connected && authStatus === 'authenticated') {
      console.log("[AppHeader Disconnect Watcher] Wallet disconnected while authenticated. Initiating full NextAuth sign-out and redirect.");
      toast.info("Wallet disconnected. Signing out...");

      (async () => {
        try {
          // No need to clear other app-specific states here as AppHeader is more global
          // The main app state clearing should happen based on authStatus changing to unauthenticated in respective hooks/pages
          await nextAuthSignOut({ redirect: false }); // Key: don't let NextAuth redirect itself
          console.log("[AppHeader Disconnect Watcher] NextAuth signOut successful. Setting logout flag and redirecting to /.");
          
          sessionStorage.setItem('logoutInProgress', 'true'); // Prevent wallet modal on landing page
          window.location.href = '/'; // Force redirect to home page

        } catch (e: any) {
          console.error("[AppHeader Disconnect Watcher] Error during NextAuth signOut or redirection:", e);
          toast.error("Error signing out after wallet disconnect.");
          // Fallback redirect even if signout call itself errors
          if (window.location.pathname !== '/') { // Avoid reload loop if already on home
            window.location.href = '/'; 
          }
        }
      })();
    }
    prevConnectedRef.current = connected; // Update the ref with the current connected state
  }, [connected, authStatus]); // Dependencies: connected, authStatus, nextAuthSignOut

  const handleOpenNotifications = () => {
    if (!connected || authStatus !== "authenticated") {
      toast.info("Please log in and connect your wallet to view notifications.");
      return;
    }
    uiState.toggleNotificationsPanel();
  };

  // Safely define typedUser only if session and session.user exist
  const typedUser = session && session.user 
    ? session.user as (typeof session.user & { 
        xId?: string | null, 
        image?: string | null, // This is the general/original image field
        name?: string | null, 
        walletAddress?: string | null,
        linkedXProfileImageUrl?: string | null, // Added from X linking
        linkedXUsername?: string | null // Added from X linking
      }) 
    : null;

  // Determine the avatar image URL: prioritize X profile image, then fallback to general image
  const avatarImageUrl = typedUser?.linkedXProfileImageUrl || typedUser?.image || null;
  const avatarUsername = typedUser?.linkedXUsername || typedUser?.name || typedUser?.xId || 'User';
  // console.log("[AppHeader DEBUG] Determined avatarImageUrl:", avatarImageUrl); // Commented out

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
                {navItems.map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    {label}
                  </Link>
                ))}
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
            {isClient && authStatus === "authenticated" && typedUser && (
              <>
                {/* Notification Bell - Show if authenticated and on client */}
                <button 
                  onClick={handleOpenNotifications} 
                  className="p-1.5 rounded-full text-gray-700 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-blue-500 relative transition-colors"
                >
                  <BellIcon className="h-5 w-5" />
                  {uiState.unreadNotificationCount > 0 && (
                    <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-1 ring-white" />
                  )}
                </button>

                <Link href="/profile" className="ml-2" aria-label="View Profile">
                  <UserAvatar 
                    profileImageUrl={avatarImageUrl} // Use the prioritized image URL
                    username={avatarUsername} // Use the prioritized username (e.g. X username if available)
                    // className removed from UserAvatar itself, Link now handles margin
                  />
                </Link>
                
                {/* Wallet Multi Button - Show if authenticated and on client, now rightmost */}
                <WalletMultiButtonDynamic 
                  className="ml-2"
                  style={{ height: '36px', borderRadius: '9999px', backgroundColor: '#3B82F6', fontSize: '0.875rem' }} 
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals and Panels */}
      {isClient && uiState.isAgentSetupModalOpen && <AgentSetupModal />}

      {isClient && uiState.isNotificationsPanelOpen && authStatus === "authenticated" && connected && (
        <NotificationsPanel 
          isOpen={uiState.isNotificationsPanelOpen} 
          onClose={uiState.toggleNotificationsPanel} 
          onUpdateUnreadCount={uiState.setUnreadNotificationCount}
        />
      )}
    </header>
  );
} 