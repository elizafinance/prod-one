"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
// import { NotificationDocument } from '@/lib/mongodb'; // Will use UnifiedNotification instead
import NotificationItem, { NotificationDisplayData } from './NotificationItem';
import { toast } from 'sonner';
import Link from 'next/link';
import { FaBell, FaTimes } from 'react-icons/fa';

// Define UnifiedNotification structure (can be moved to a shared types file)
interface UnifiedNotification {
  _id: string; 
  type: 'squad_invite' | 'generic_notification'; 
  message: string;
  squadId?: string; 
  squadName?: string;
  inviterWalletAddress?: string; 
  isRead: boolean; 
  createdAt: Date;
  // Potentially add other fields like an icon or a specific link based on type
  ctaLink?: string; // Call to action link
  ctaText?: string; // Call to action text
}

// Define the structure of the API response for notifications
interface NotificationsApiResponse {
  notifications: NotificationDisplayData[];
  unreadCount: number;
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateUnreadCount: (count: number) => void; // To update bell icon badge
}

export default function NotificationsPanel({ isOpen, onClose, onUpdateUnreadCount }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<NotificationDisplayData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null); // For click outside to close
  const initialFetchDone = useRef(false); // To track if initial fetch on open has occurred
  const hasAttemptedMarkReadOnOpenRef = useRef(false); // ADDED: Track if mark as read attempted on open

  const handleClearAllNotifications = async () => {
    if (!window.confirm("Are you sure you want to clear ALL your notifications? This cannot be undone.")) {
      return;
    }
    setIsLoading(true); // Use panel's isLoading or a dedicated one
    setError(null);
    try {
      const response = await fetch('/api/notifications/all', { method: 'DELETE' });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to clear notifications');
      }
      const result = await response.json();
      toast.success(result.message || "All notifications cleared!");
      fetchNotifications(false); // Re-fetch to show empty list
      onUpdateUnreadCount(0); // Update store immediately
    } catch (err: any) {
      console.error("Error in handleClearAllNotifications (Panel):", err);
      setError(err.message || "Failed to clear all notifications."); // Show error in panel
    } finally {
      setIsLoading(false);
    }
  };

  // Define fetchNotifications first
  const fetchNotifications = useCallback(async (isInitialOpenFetch = false) => { // Removed attemptMarkAsRead param
    setIsLoading(true);
    setError(null);
    console.log("[Notifications] Fetching notifications...");
    try {
      console.log("[Notifications] Making API call to fetch notifications");
      const response = await fetch('/api/notifications/my-notifications');
      
      console.log("[Notifications] API response status:", response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        const errorMessage = errorData.error || `Failed to fetch notifications: ${response.status}`;
        console.error("[Notifications] Response not OK:", errorMessage);
        throw new Error(errorMessage);
      }
      
      const data: NotificationsApiResponse = await response.json();
      console.log("[Notifications] Received data:", data);
      
      if (!data.notifications) {
        console.warn("[Notifications] No notifications array in response");
      }
      
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
      onUpdateUnreadCount(data.unreadCount || 0);

      // This part is tricky because markNotificationsAsRead is defined later
      // We will call it from an effect or directly if needed, but not from here to avoid circular dep.
      // For now, we assume that if attemptMarkAsRead is true, an effect will handle it.
      // Or, the caller of fetchNotifications (like markNotificationsAsRead) will handle subsequent logic.

    } catch (err) {
      console.error("[Notifications] Error during fetch:", err);
      setError((err as Error).message || 'Could not load notifications.');
      onUpdateUnreadCount(0); // Reset unread count on error
    }
    setIsLoading(false);
  }, [onUpdateUnreadCount]); // Removed markNotificationsAsRead from here

  const markNotificationsAsRead = useCallback(async (notificationIds: string[]) => {
    if (notificationIds.length === 0) return false; // Return a boolean indicating if an update was attempted
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds }),
      });
      // const data = await response.json(); 

      if (response.ok) {
        const newlyReadCount = notificationIds.length;
        setNotifications(prev =>
          prev.map(n => (notificationIds.includes(n.notificationId) ? { ...n, isRead: true } : n))
        );
        const newLocalUnreadCount = Math.max(0, unreadCount - newlyReadCount);
        setUnreadCount(newLocalUnreadCount);
        onUpdateUnreadCount(newLocalUnreadCount); 
        return true; // Indicate success
      } else {
        toast.error("Failed to mark notifications as read.");
        return false; // Indicate failure
      }
    } catch (err) {
      toast.error("Error marking notifications as read.");
      console.error("markNotificationsAsRead error:", err);
      return false; // Indicate failure
    }
  }, [onUpdateUnreadCount, unreadCount, setNotifications, setUnreadCount]);

  useEffect(() => {
    if (isOpen && !initialFetchDone.current) {
      fetchNotifications(true); // isInitialOpenFetch = true
      initialFetchDone.current = true;
      hasAttemptedMarkReadOnOpenRef.current = false;
    } else if (!isOpen) {
      initialFetchDone.current = false; // Reset for next time panel opens
      hasAttemptedMarkReadOnOpenRef.current = false; // MODIFIED: Reset when panel closes
    }
  }, [isOpen, fetchNotifications]);

  // Effect to mark unread notifications as read *after* initial fetch and only ONCE per open
  useEffect(() => {
    if (isOpen && initialFetchDone.current && notifications.length > 0 && !hasAttemptedMarkReadOnOpenRef.current) {
        const unreadIds = notifications
            .filter(n => !n.isRead)
            .map(n => n.notificationId);
        if (unreadIds.length > 0) {
            console.log(`[NotificationsPanel] Attempting to mark as read IDs:`, unreadIds, `for wallet: ${sessionStorage.getItem('currentUserWalletAddress')}`); // Assuming you store wallet address in session storage for client-side logging, or derive it differently

            if (typeof markNotificationsAsRead === 'function') {
                (async () => {
                    const success = await markNotificationsAsRead(unreadIds);
                    if (success) { // Only set if the API call was at least successful in responding
                        hasAttemptedMarkReadOnOpenRef.current = true;
                    } else {
                        // If marking failed, we might want to allow another attempt on next interaction or re-open
                        // For now, we'll still set it to true to prevent loops from continuous failures,
                        // but this could be refined to allow retries under certain conditions.
                        hasAttemptedMarkReadOnOpenRef.current = true; 
                    }
                })();
            }
        } else {
           hasAttemptedMarkReadOnOpenRef.current = true; // No unread notifications to mark
        }
    }
  // We only want this to run when `notifications` list updates *after* an initial fetch,
  // and `isOpen` is true. `markNotificationsAsRead` is stable due to useCallback.
  }, [isOpen, notifications, markNotificationsAsRead]); // Dependency array unchanged for now, logic change is inside

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleMarkOneAsRead = (notificationId: string) => {
    markNotificationsAsRead([notificationId]);
  };
  
  const handleMarkAllAsRead = () => {
    const allUnreadIds = notifications.filter(n => !n.isRead).map(n => n.notificationId); // Use notificationId
    console.log("[NotificationsPanel] Attempting to mark all as read. Unread IDs collected:", allUnreadIds); // DEBUG LOG
    if(allUnreadIds.length > 0) {
        markNotificationsAsRead(allUnreadIds);
    } else {
        toast.info("No unread notifications to mark.");
    }
  };

  const handleRetry = () => {
    fetchNotifications(true); // Retry with attempt to mark as read
  };

  // Passed to NotificationItem, uses notificationId which is the client-side consistent ID
  const onMarkIndividualNotificationAsRead = useCallback(async (notificationId: string): Promise<void> => {
    // Directly call markNotificationsAsRead, which now handles optimistic updates
    await markNotificationsAsRead([notificationId]);
  }, [markNotificationsAsRead]);

  if (!isOpen) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button 
        onClick={onClose} 
        className="relative p-2 rounded-full hover:bg-muted focus:outline-none focus:ring-2 focus:ring-[#2B96F1] focus:ring-opacity-50 transition-colors"
        aria-label="Toggle Notifications"
      >
        <FaBell className="h-6 w-6 text-muted-foreground hover:text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-2.5 w-2.5 transform -translate-y-1/2 translate-x-1/2">
            {/* Single static badge without continuous ping animation to avoid distracting blink */}
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
          <div className="flex justify-between items-center p-3 border-b border-border">
            <h3 className="text-md font-semibold text-foreground">Notifications ({unreadCount})</h3>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <FaTimes />
            </button>
          </div>

          {/* Clear All Notifications Button - FOR TESTING - Panel */}
          <div className="p-2 border-b border-border text-center">
            <button
              onClick={handleClearAllNotifications}
              disabled={isLoading || notifications.length === 0}
              className="w-full px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear All Notifications (Dev Panel)
            </button>
          </div>
          {/* --- END Clear All Button --- */}

          {isLoading && (
            <div className="p-8 flex justify-center items-center">
              <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-blue-500 rounded-full"></div>
              <p className="ml-3 text-muted-foreground">Loading notifications...</p>
            </div>
          )}
          
          {error && (
            <div className="p-4 text-center text-red-400 bg-red-900/20 m-4 rounded-lg">
              <p className="font-semibold mb-2">Error</p>
              <p className="text-sm mb-2">{error}</p>
              <div className="flex justify-center space-x-3 mt-2">
                <button onClick={handleRetry} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md transition-colors">
                  Retry
                </button>
                <button onClick={() => setShowErrorDetails(!showErrorDetails)} className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs rounded-md transition-colors">
                  {showErrorDetails ? 'Hide Details' : 'Show Details'}
                </button>
              </div>
              {showErrorDetails && (
                <p className="mt-2 text-xs text-left bg-black/30 p-2 rounded overflow-auto">
                  If you are seeing authentication errors, try refreshing the page or reconnecting your wallet.
                </p>
              )}
            </div>
          )}
          
          {!isLoading && !error && notifications.length === 0 && (
            <p className="p-8 text-center text-muted-foreground">You have no notifications yet.</p>
          )}

          {!isLoading && !error && notifications.length > 0 && (
            <div className="overflow-y-auto flex-grow">
              {notifications.map(notif => (
                <NotificationItem 
                  key={notif.notificationId} 
                  notification={notif} 
                  onMarkAsRead={onMarkIndividualNotificationAsRead}
                />
              ))}
            </div>
          )}
          
          {notifications.length > 0 && (
            <div className="p-2 border-t border-border text-center">
                <Link href="/notifications" className="text-sm text-blue-400 hover:underline" onClick={onClose}>
                    View all notifications
                </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 