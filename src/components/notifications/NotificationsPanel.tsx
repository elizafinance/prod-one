"use client";

import { useState, useEffect, useCallback } from 'react';
import { NotificationDocument } from '@/lib/mongodb';
import NotificationItem from './NotificationItem';
import { toast } from 'sonner';
import Link from 'next/link';

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdateUnreadCount: (count: number) => void; // To update bell icon badge
}

export default function NotificationsPanel({ isOpen, onClose, onUpdateUnreadCount }: NotificationsPanelProps) {
  const [notifications, setNotifications] = useState<NotificationDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (markAsReadOnOpen = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/notifications/my-notifications?limit=10'); // Fetch latest 10 initially
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      const data = await response.json();
      setNotifications(data.notifications || []);
      onUpdateUnreadCount(data.unreadCount || 0);

      if (markAsReadOnOpen && data.notifications && data.notifications.length > 0) {
        const unreadIds = data.notifications.filter((n: NotificationDocument) => !n.isRead).map((n: NotificationDocument) => n.notificationId);
        if (unreadIds.length > 0) {
          markNotificationsAsRead(unreadIds);
        }
      }
    } catch (err) {
      setError((err as Error).message || 'Could not load notifications.');
      console.error(err);
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
    const allUnreadIds = notifications.filter(n => !n.isRead).map(n => n.notificationId);
    if(allUnreadIds.length > 0) {
        markNotificationsAsRead(allUnreadIds);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity duration-300 ease-in-out"
      onClick={onClose} // Close if clicking outside the panel
    >
      <div 
        className="fixed top-16 right-4 sm:right-8 w-full max-w-md bg-gray-800 shadow-2xl rounded-lg border border-gray-700 z-50 max-h-[70vh] flex flex-col transition-transform duration-300 ease-in-out transform scale-95 opacity-0 animate-in fade-in zoom-in-95 slide-in-from-top-2"
        onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside panel
        style={{ animationFillMode: 'forwards' }} // Ensure animation styles persist
      >
        <div className="flex justify-between items-center p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Notifications</h2>
          {notifications.some(n => !n.isRead) && (
             <button onClick={handleMarkAllAsRead} className="text-xs text-blue-400 hover:underline">Mark all as read</button>
          )}
          <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
        </div>

        {isLoading && <p className="p-4 text-center text-gray-400">Loading notifications...</p>}
        {error && <p className="p-4 text-center text-red-400">Error: {error}</p>}
        
        {!isLoading && !error && notifications.length === 0 && (
          <p className="p-4 text-center text-gray-400">You have no notifications yet.</p>
        )}

        {!isLoading && !error && notifications.length > 0 && (
          <ul className="overflow-y-auto flex-grow">
            {notifications.map(notif => (
              <NotificationItem key={notif.notificationId} notification={notif} onMarkAsRead={handleMarkOneAsRead} />
            ))}
          </ul>
        )}
        <div className="p-3 border-t border-gray-700 text-center">
            <Link href="/notifications" passHref>
                 <span onClick={onClose} className="text-sm text-blue-400 hover:underline cursor-pointer">View all notifications</span>
            </Link>
        </div>
      </div>
    </div>
  );
} 