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

  // Define fetchNotifications first
  const fetchNotifications = useCallback(async (isInitialOpenFetch = false, attemptMarkAsRead = true) => { // Added attemptMarkAsRead
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
    if (notificationIds.length === 0) return;
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds }),
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (notificationIds.includes(n.notificationId) ? { ...n, isRead: true } : n))
        );
        // Call fetchNotifications to get the latest state from the server,
        // but without triggering another mark-as-read cycle from within fetchNotifications itself.
        fetchNotifications(false, false); // isInitialOpenFetch = false, attemptMarkAsRead = false
        if (notificationIds.length === 1) {
          toast.info("Notification marked as read.");
        }
        // The unread count will be updated by fetchNotifications
      } else {
        toast.error("Failed to mark notifications as read.");
      }
    } catch (err) {
      toast.error("Error marking notifications as read.");
      console.error("markNotificationsAsRead error:", err);
    }
  }, [fetchNotifications]); // Removed onUpdateUnreadCount, only fetchNotifications

  useEffect(() => {
    if (isOpen && !initialFetchDone.current) {
      fetchNotifications(true, true); // isInitialOpenFetch = true, attemptMarkAsRead = true
      initialFetchDone.current = true;
    } else if (!isOpen) {
      initialFetchDone.current = false; // Reset for next time panel opens
    }
  }, [isOpen, fetchNotifications]);

  // Effect to mark unread notifications as read *after* initial fetch
  useEffect(() => {
    if (isOpen && initialFetchDone.current && notifications.length > 0) {
        const unreadIds = notifications
            .filter(n => !n.isRead)
            .map(n => n.notificationId);
        if (unreadIds.length > 0) {
            // Check if markNotificationsAsRead is available to be called
            // This check is to satisfy linters if they still think markNotificationsAsRead might not be initialized
            // though due to JS hoisting and useCallback, it should be.
            if (typeof markNotificationsAsRead === 'function') { 
                 markNotificationsAsRead(unreadIds);
            }
        }
    }
  // We only want this to run when `notifications` list updates *after* an initial fetch,
  // and `isOpen` is true. `markNotificationsAsRead` is stable due to useCallback.
  }, [isOpen, notifications, markNotificationsAsRead]);

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
    await markNotificationsAsRead([notificationId]);
  }, [markNotificationsAsRead]);

  if (!isOpen) return null;

  return (
    <div className="relative" ref={panelRef}>
      <button 
        onClick={onClose} 
        className="relative p-2 rounded-full hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors"
        aria-label="Toggle Notifications"
      >
        <FaBell className="h-6 w-6 text-gray-300 hover:text-white" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 block h-2.5 w-2.5 transform -translate-y-1/2 translate-x-1/2">
            {/* Single static badge without continuous ping animation to avoid distracting blink */}
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 100px)' }}>
          <div className="flex justify-between items-center p-3 border-b border-gray-700">
            <h3 className="text-md font-semibold text-gray-100">Notifications ({unreadCount})</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <FaTimes />
            </button>
          </div>

          {isLoading && (
            <div className="p-8 flex justify-center items-center">
              <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-blue-500 rounded-full"></div>
              <p className="ml-3 text-gray-400">Loading notifications...</p>
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
                <button onClick={() => setShowErrorDetails(!showErrorDetails)} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded-md transition-colors">
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
            <p className="p-8 text-center text-gray-400">You have no notifications yet.</p>
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
            <div className="p-2 border-t border-gray-700 text-center">
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