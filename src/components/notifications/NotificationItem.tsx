"use client";

import React, { useState } from 'react';
// import { NotificationDocument } from "@/lib/mongodb"; // Using UnifiedNotification
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Define UnifiedNotification structure (consistent with NotificationsPanel)
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

interface NotificationItemProps {
  notification: UnifiedNotification; // Use UnifiedNotification
  onMarkAsRead: (notificationId: string) => void; 
}

// Basic icons (replace with actual icon components if you have them)
const SquadIcon = () => <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white">S</div>;
const UserIcon = () => <span className="mr-2">👤</span>;
const InfoIcon = () => <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white">i</div>;

export default function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  const getIcon = () => {
    if (notification.type === 'squad_invite') return <SquadIcon />;
    // Add more icon logic based on notification.type for 'generic_notification'
    return <InfoIcon />;
  };

  const isSquadInvite = notification.type === 'squad_invite';

  const handleNotificationClick = () => {
    // For squad invites, clicking might not mark as read directly; actions (accept/decline) do.
    // For generic notifications, this could call onMarkAsRead.
    if (!notification.isRead && notification.type === 'generic_notification') {
      onMarkAsRead(notification._id); // Use _id
    }
    
    // Navigate based on notification type or ctaLink
    if (notification.ctaLink) {
        router.push(notification.ctaLink);
    } else if (notification.type === 'squad_invite' && notification.squadId) {
      router.push(`/squads/${notification.squadId}`);
    }
  };

  const handleAcceptInvite = async (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (!isSquadInvite || !notification.squadId) return;
    
    setIsProcessing('accept');
    try {
      const response = await fetch('/api/squads/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: notification._id }), // Use _id
      });
      
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || 'Invitation accepted!');
        // onMarkAsRead(notification._id); // Accepting effectively makes it "read" or acted upon.
        // Refreshing notifications in the panel is handled by the panel's fetchNotifications after markAsRead
        // For now, parent panel will refetch. Consider direct state update if needed.
        if (notification.squadId) {
          router.push(`/squads/${notification.squadId}`);
        }
      } else {
        toast.error(data.error || 'Failed to accept invitation');
      }
    } catch (err) {
      toast.error('An error occurred while processing the invitation');
      console.error(err);
    }
    setIsProcessing(null);
  };

  const handleDeclineInvite = async (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (!isSquadInvite) return;

    setIsProcessing('decline');
    try {
      const response = await fetch('/api/squads/invitations/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: notification._id }), // Use _id
      });
      
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || 'Invitation declined');
        // onMarkAsRead(notification._id); // Declining also makes it "read" or acted upon.
        // Parent panel will refetch.
      } else {
        toast.error(data.error || 'Failed to decline invitation');
      }
    } catch (err) {
      toast.error('An error occurred while processing the invitation');
      console.error(err);
    }
    setIsProcessing(null);
  };

  return (
    <li 
      className={`p-3 border-b border-gray-700 last:border-b-0 hover:bg-gray-700/30 transition-colors ${notification.isRead ? 'opacity-75' : 'bg-gray-700/20'}`}
      onClick={isSquadInvite ? undefined : handleNotificationClick} // Only allow general click for non-squad invites
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-0.5 mr-3">
          {getIcon()}
        </div>
        <div className="flex-grow">
          <p className={`text-sm ${notification.isRead ? 'text-gray-400' : 'text-gray-100'} mb-1 break-words`}>
            {notification.message}
            {notification.type === 'squad_invite' && notification.squadName && 
              <span className="font-semibold"> {notification.squadName}</span>
            }
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(notification.createdAt || Date.now()).toLocaleString()} 
            {notification.ctaText && notification.ctaLink &&
              <Link href={notification.ctaLink} className="ml-2 text-blue-400 hover:underline" onClick={(e)=> e.stopPropagation()}>{notification.ctaText}</Link>
            }
          </p>
          
          {/* Action buttons for squad invites */}
          {isSquadInvite && !notification.isRead && (
            <div className="mt-2 flex space-x-2">
              <button 
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded-md transition-colors disabled:opacity-50"
                onClick={handleAcceptInvite}
                disabled={isProcessing !== null}
              >
                {isProcessing === 'accept' ? 'Accepting...' : 'Accept'}
              </button>
              <button 
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-md transition-colors disabled:opacity-50"
                onClick={handleDeclineInvite}
                disabled={isProcessing !== null}
              >
                {isProcessing === 'decline' ? 'Declining...' : 'Decline'}
              </button>
            </div>
          )}
        </div>
        {!notification.isRead && (
          <div className="ml-2 flex-shrink-0">
            <span className="w-2 h-2 bg-blue-500 rounded-full inline-block" title="Unread"></span>
          </div>
        )}
      </div>
    </li>
  );
} 