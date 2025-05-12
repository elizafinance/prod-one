"use client";

import { useState, useEffect, useCallback } from 'react';
// import { NotificationDocument } from '@/lib/mongodb'; // Will use UnifiedNotification
import NotificationItem from '@/components/notifications/NotificationItem'; // Adjust path if needed
import { toast } from 'sonner';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react'; // To ensure user is connected for API calls

// Define UnifiedNotification structure (should be consistent with other usages)
interface UnifiedNotification {
  _id: string; 
  type: 'squad_invite' | 'generic_notification'; 
  message: string;
  squadId?: string; 
  squadName?: string;
  inviterWalletAddress?: string; 
  isRead: boolean; 
  createdAt: Date;
  ctaLink?: string; 
  ctaText?: string; 
}

export default function AllNotificationsPage() {
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]); // Use UnifiedNotification
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const { connected } = useWallet();

  const fetchAllNotifications = useCallback(async (markAsReadOnClick = false) => {
    if (!connected) return; // Don't fetch if wallet not connected (session won't be there for API)
    
    setIsLoading(true);
    setError(null);
    try {
      // Fetch with a higher limit or no limit for "all" notifications page
      const response = await fetch('/api/notifications/my-notifications?limit=100'); 
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      const data: { notifications: UnifiedNotification[], unreadCount: number } = await response.json(); // Explicitly type data
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0); 
      // No automatic mark as read for all on this page, only individual clicks or "Mark All"
    } catch (err) {
      setError((err as Error).message || 'Could not load notifications.');
      console.error(err);
    }
    setIsLoading(false);
  }, [connected]);

  useEffect(() => {
    fetchAllNotifications();
  }, [fetchAllNotifications]);

  const markNotificationsAsRead = async (notificationIds: string[]) => {
    if (notificationIds.length === 0) return;
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds }),
      });
      if (response.ok) {
        // Refresh notifications to show them as read and update unread count
        fetchAllNotifications(); 
        toast.success("Notifications marked as read.")
      } else {
        toast.error("Failed to mark notifications as read.");
      }
    } catch (err) {
      toast.error("Error marking notifications as read.");
      console.error(err);
    }
  };

  const handleMarkOneAsRead = (notificationId: string) => {
    // Check if already read to avoid unnecessary API call, though backend also checks
    const notif = notifications.find(n => n._id === notificationId); // Use _id for finding
    if (notif && !notif.isRead) {
        markNotificationsAsRead([notificationId]);
    }
  };
  
  const handleMarkAllAsRead = () => {
    const allUnreadIds = notifications.filter(n => !n.isRead).map(n => n._id); // Use _id for mapping
    if(allUnreadIds.length > 0) {
        markNotificationsAsRead(allUnreadIds);
    } else {
        toast.info("No unread notifications to mark.");
    }
  };

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="w-full max-w-3xl mx-auto py-8 sm:py-12">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-500 to-sky-500">
            All Notifications
          </h1>
          <Link href="/" passHref>
            <button 
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out whitespace-nowrap"
            >
              Back to Dashboard
            </button>
          </Link>
        </div>

        <div className="mb-6 flex justify-end">
            {notifications.length > 0 && unreadCount > 0 && (
                 <button onClick={handleMarkAllAsRead} className="text-sm bg-blue-500 hover:bg-blue-600 text-white font-semibold py-1.5 px-3 rounded-md shadow-sm transition-colors">
                    Mark all ({unreadCount}) as read
                </button>
            )}
        </div>

        {isLoading && (
          <div className="text-center py-10">
            <p className="text-xl text-gray-400">Loading All Notifications...</p>
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500 mx-auto mt-4"></div>
          </div>
        )}
        {error && <p className="text-center text-red-400 bg-red-900 bg-opacity-30 p-4 rounded-lg">Error: {error}</p>}
        
        {!isLoading && !error && notifications.length === 0 && (
          <div className="text-center py-10 bg-gray-800 bg-opacity-50 p-6 rounded-lg shadow-xl">
            <p className="text-2xl text-gray-300 mb-3">No Notifications Found!</p>
            <p className="text-gray-400">All quiet on the notification front.</p>
          </div>
        )}

        {!isLoading && !error && notifications.length > 0 && (
          <div className="bg-white/5 backdrop-blur-sm shadow-2xl rounded-xl p-2 sm:p-4">
            <ul className="divide-y divide-gray-700/50">
              {notifications.map(notif => (
                <NotificationItem key={notif._id} notification={notif} onMarkAsRead={handleMarkOneAsRead} /> // Use _id for key
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
} 