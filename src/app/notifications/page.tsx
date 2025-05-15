"use client";

import React, { useState, useEffect, useCallback } from 'react';
// import { NotificationDocument } from '@/lib/mongodb'; // Will use UnifiedNotification
import NotificationItem, { NotificationDisplayData } from '@/components/notifications/NotificationItem'; // Adjust path if needed
import { toast } from 'sonner';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react'; // To ensure user is connected for API calls

interface NotificationsApiResponse {
  notifications: NotificationDisplayData[];
  unreadCount: number;
  currentPage: number;
  totalPages: number;
  totalNotifications: number;
}

const NOTIFICATIONS_PER_PAGE = 20; // Match default or allow config

export default function NotificationsHistoryPage() {
  const [notifications, setNotifications] = useState<NotificationDisplayData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connected } = useWallet();

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAllNotifications = useCallback(async (pageToFetch = 1) => {
    if (!connected) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/notifications?page=${pageToFetch}&limit=${NOTIFICATIONS_PER_PAGE}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch notifications');
      }
      const data: NotificationsApiResponse = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching all notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    fetchAllNotifications(currentPage);
  }, [fetchAllNotifications, currentPage, connected]); // Add connected to re-fetch if wallet connects

  const handleMarkAsRead = async (notificationId: string): Promise<void> => {
    // Optimistically update UI. NotificationItem calls the API.
    setNotifications(prev => prev.map(n => 
      n.notificationId === notificationId ? { ...n, isRead: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev -1));
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to mark all notifications as read');
      }
      // const result = await response.json();
      // console.log(result.message);
      // alert(result.message); // Or use a toast notification
      // Refetch notifications to get the updated state from the server
      fetchAllNotifications(currentPage); 
    } catch (err: any) {
      console.error("Error in handleMarkAllAsRead:", err);
      setError(err.message || "Failed to mark all notifications as read.");
      setIsLoading(false); // Ensure loading is stopped on error
    }
    // setIsLoading(false) will be called by fetchAllNotifications in its finally block if successful
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (!connected && !isLoading) { // Show connect wallet message if not loading and not connected
    return (
        <div className="container mx-auto px-4 py-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-6">Notifications</h1>
            <p className="text-xl text-gray-400">Please connect your wallet to view your notifications.</p>
            {/* Optionally, add a wallet connect button here if you have a global one */} 
        </div>
    );
  }

  if (isLoading && notifications.length === 0) { // Show full page loader only if no data yet
    return <div className="container mx-auto px-4 py-8 text-center text-xl text-gray-400">Loading notifications...</div>;
  }

  if (error) {
    return <div className="container mx-auto px-4 py-8 text-center text-xl text-red-500">Error: {error}</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 bg-gray-900 min-h-screen text-gray-100">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700">
          <h1 className="text-3xl font-bold text-white">All Notifications</h1>
          {unreadCount > 0 && (
             <button 
                onClick={handleMarkAllAsRead}
                disabled={isLoading} // Disable button while any loading is in progress
                className="text-sm text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
             >
                Mark all as read ({unreadCount})
             </button>
          )}
        </div>

        {notifications.length === 0 && !isLoading ? (
          <div className="text-center py-10">
            <p className="text-gray-400 text-lg">You have no notifications.</p>
            <Link href="/quests" className="mt-4 inline-block text-blue-400 hover:underline">
              Explore Quests
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-px bg-gray-800 rounded-lg shadow">
              {notifications.map(notif => (
                <NotificationItem 
                  key={notif.notificationId} 
                  notification={notif} 
                  onMarkAsRead={handleMarkAsRead} 
                />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center space-x-2">
                <button 
                  onClick={() => handlePageChange(currentPage - 1)} 
                  disabled={currentPage === 1 || isLoading}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter(pageNumber => 
                    pageNumber === 1 || pageNumber === totalPages || 
                    (pageNumber >= currentPage -1 && pageNumber <= currentPage + 1) ||
                    (currentPage <=3 && pageNumber <=3) ||
                    (currentPage >= totalPages - 2 && pageNumber >= totalPages -2)
                ).map((pageNumber, index, arr) => (
                    <React.Fragment key={pageNumber}>
                        {index > 0 && arr[index-1] !== pageNumber -1 && <span className="text-gray-500 px-1">...</span>}
                        <button 
                            onClick={() => handlePageChange(pageNumber)} 
                            disabled={isLoading}
                            className={`px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed ${currentPage === pageNumber ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                        >
                            {pageNumber}
                        </button>
                    </React.Fragment>
                ))}
                <button 
                  onClick={() => handlePageChange(currentPage + 1)} 
                  disabled={currentPage === totalPages || isLoading}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 