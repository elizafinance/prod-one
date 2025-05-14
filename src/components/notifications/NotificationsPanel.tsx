"use client";

import { useState, useEffect, useCallback } from 'react';
// import { NotificationDocument } from '@/lib/mongodb'; // Will use UnifiedNotification instead
import NotificationItem from './NotificationItem';
import { toast } from 'sonner';
import Link from 'next/link';

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

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateUnreadCount: (count: number) => void; // To update bell icon badge
}

export default function NotificationsPanel({ isOpen, onClose, onUpdateUnreadCount }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]); // Use UnifiedNotification
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const fetchNotifications = useCallback(async (markAsReadOnOpen = false) => {
    setIsLoading(true);
    setError(null);
    console.log("[Notifications] Fetching notifications...");
    try {
      console.log("[Notifications] Making API call to fetch notifications");
      const response = await fetch('/api/notifications/my-notifications?limit=10'); // Fetch latest 10 initially
      
      console.log("[Notifications] API response status:", response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        const errorMessage = errorData.error || `Failed to fetch notifications: ${response.status}`;
        console.error("[Notifications] Response not OK:", errorMessage);
        throw new Error(errorMessage);
      }
      
      const data: { notifications: UnifiedNotification[], unreadCount: number } = await response.json();
      console.log("[Notifications] Received data:", data);
      
      if (!data.notifications) {
        console.warn("[Notifications] No notifications array in response");
      }
      
      setNotifications(data.notifications || []);
      onUpdateUnreadCount(data.unreadCount || 0);

      if (markAsReadOnOpen && data.notifications && data.notifications.length > 0) {
        // Mark as read logic might need to change if we don't have a generic isRead for invites
        // For now, this attempts to mark items that have an _id and an isRead property if API supported it
        const unreadIds = data.notifications.filter((n: UnifiedNotification) => !n.isRead).map((n: UnifiedNotification) => n._id);
        console.log("[Notifications] Unread IDs to mark as read on open:", unreadIds);
        if (unreadIds.length > 0) {
          markNotificationsAsRead(unreadIds);
        }
      }
    } catch (err) {
      console.error("[Notifications] Error during fetch:", err);
      setError((err as Error).message || 'Could not load notifications.');
      onUpdateUnreadCount(0); // Reset unread count on error
    }
    setIsLoading(false);
  }, [onUpdateUnreadCount]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications(true); // Fetch and mark as read when panel opens
    }
  }, [isOpen, fetchNotifications]);

  const markNotificationsAsRead = async (notificationIds: string[]) => {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds }),
      });
      if (response.ok) {
        // Refresh notifications to show them as read and update unread count
        fetchNotifications(); 
      } else {
        toast.error("Failed to mark notifications as read.");
      }
    } catch (err) {
      toast.error("Error marking notifications as read.");
      console.error(err);
    }
  };

  const handleMarkOneAsRead = (notificationId: string) => {
    markNotificationsAsRead([notificationId]);
  };
  
  const handleMarkAllAsRead = () => {
    // This also needs to be aware of the source of notifications if they are marked read differently
    const allUnreadIds = notifications.filter(n => !n.isRead).map(n => n._id);
    console.log("[NotificationsPanel] Attempting to mark all as read. Unread IDs collected:", allUnreadIds); // DEBUG LOG
    if(allUnreadIds.length > 0) {
        markNotificationsAsRead(allUnreadIds);
    } else {
        toast.info("No unread notifications to mark.");
    }
    // toast.info("Mark all as read feature needs review for unified notification types.");
  };

  const handleRetry = () => {
    fetchNotifications();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
      onClick={onClose} // Close if clicking outside the panel
    >
      <div 
        className="fixed top-16 right-4 sm:right-8 w-full max-w-md bg-gray-800 shadow-2xl rounded-lg border border-gray-700 z-50 max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside panel
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Notifications</h2>
          {notifications.some(n => !n.isRead) && (
             <button onClick={handleMarkAllAsRead} className="text-xs text-blue-400 hover:underline">Mark all as read</button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>

        <div className="overflow-y-auto flex-grow">
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
            <ul>
              {notifications.map(notif => (
                <NotificationItem key={notif._id} notification={notif} onMarkAsRead={handleMarkOneAsRead} />
              ))}
            </ul>
          )}
        </div>
        
        <div className="p-3 border-t border-gray-700 text-center">
            <Link href="/notifications" passHref>
                 <span onClick={onClose} className="text-sm text-blue-400 hover:underline cursor-pointer">View all notifications</span>
            </Link>
        </div>
      </div>
    </div>
  );
} 