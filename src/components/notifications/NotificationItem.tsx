"use client";

import React, { useState } from 'react';
import { NotificationDocument } from "@/lib/mongodb"; // Assuming your type is in mongodb.ts
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface NotificationItemProps {
  notification: NotificationDocument;
  onMarkAsRead: (notificationId: string) => void; // Callback to mark as read
}

// Basic icons (replace with actual icon components if you have them)
const SquadIcon = () => <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white">S</div>;
const UserIcon = () => <span className="mr-2">👤</span>;
const InfoIcon = () => <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white">i</div>;

export default function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  const getIcon = () => {
    if (notification.type.startsWith('squad_')) return <SquadIcon />;
    // Add more icon logic based on notification.type
    return <InfoIcon />;
  };

  const isSquadInvite = notification.type === 'squad_invite_received';

  const handleNotificationClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.notificationId);
    }
    
    // Navigate based on notification type
    if (notification.type.includes('squad_') && notification.relatedSquadId) {
      router.push(`/squads/${notification.relatedSquadId}`);
    }
  };

  const handleAcceptInvite = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent the notification click handler from firing
    if (!notification.relatedSquadId) return;
    
    setIsProcessing('accept');
    try {
      const response = await fetch('/api/squads/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: notification.notificationId }),
      });
      
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || 'Invitation accepted!');
        onMarkAsRead(notification.notificationId);
        // Redirect to the squad page
        if (notification.relatedSquadId) {
          router.push(`/squads/${notification.relatedSquadId}`);
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
    e.stopPropagation(); // Prevent the notification click handler from firing
    
    setIsProcessing('decline');
    try {
      const response = await fetch('/api/squads/invitations/decline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: notification.notificationId }),
      });
      
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || 'Invitation declined');
        onMarkAsRead(notification.notificationId);
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
      onClick={handleNotificationClick}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-0.5 mr-3">
          {getIcon()}
        </div>
        <div className="flex-grow">
          <p className={`text-sm ${notification.isRead ? 'text-gray-400' : 'text-gray-100'} mb-1`}>
            {notification.message}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(notification.createdAt || Date.now()).toLocaleString()} 
            {/* Add link if relevant, e.g., to squad or user profile */}
            {/* {notification.relatedSquadId && 
              <Link href={`/squads/${notification.relatedSquadId}`} className="ml-2 text-blue-400 hover:underline">View Squad</Link>}
            */}
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