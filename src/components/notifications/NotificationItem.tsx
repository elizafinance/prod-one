"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FaGift, FaUsers, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa'; 
import { NotificationType } from '@/lib/mongodb'; // Assuming NotificationType is here

// Consistent interface based on what NotificationsPanel receives from the API
export interface NotificationDisplayData {
  _id: string; // MongoDB ObjectId as string for the NotificationDocument itself
  notificationId: string; // Primary client-side ID; for invites, this is relatedInvitationId
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  ctaUrl?: string;
  isRead: boolean;
  createdAt?: string; // ISO Date string
  updatedAt?: string; // ISO Date string
  relatedQuestId?: string;
  relatedQuestTitle?: string;
  relatedSquadId?: string;
  relatedSquadName?: string;
  relatedUserId?: string;    // e.g., inviter, referrer
  relatedUserName?: string;
  relatedInvitationId?: string; // The actual ID of the squad invitation if type is invite
  rewardAmount?: number;
  rewardCurrency?: string;
  badgeId?: string;
  // Kept if still used, but prefer structured data above
  reward_details_summary?: string; // From HEAD branch, if needed for display
}

interface NotificationItemProps {
  notification: NotificationDisplayData;
  onMarkAsRead: (notificationId: string) => Promise<void>; 
}

const getIconForNotificationType = (type: NotificationType | string) => { // Allow string for safety
  if (type.includes('reward')) return <FaGift className="text-green-400 mr-3 text-xl" />;
  if (type.includes('quest_completed')) return <FaCheckCircle className="text-blue-400 mr-3 text-xl" />;
  if (type.includes('badge')) return <FaCheckCircle className="text-yellow-400 mr-3 text-xl" />;
  if (type.includes('quest')) return <FaUsers className="text-purple-400 mr-3 text-xl" />;
  if (type.includes('squad')) return <FaUsers className="text-teal-400 mr-3 text-xl" />;
  return <FaExclamationCircle className="text-gray-400 mr-3 text-xl" />;
};

const timeAgo = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onMarkAsRead }) => {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const handleNotificationClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.notificationId); // Use client-side notificationId
    }
    if (notification.ctaUrl) {
      router.push(notification.ctaUrl);
    }
  };

  const handleInviteAction = async (e: React.MouseEvent, action: 'accept' | 'decline') => {
    e.stopPropagation(); 
    // For squad_invite_received, notificationId is the relatedInvitationId from the panel
    const invitationIdToProcess = notification.notificationId; 

    if (notification.type !== 'squad_invite_received' || !invitationIdToProcess) {
        toast.error("Cannot process this action for this notification type.");
        return;
    }
    
    setIsProcessing(action);
    try {
      const response = await fetch(`/api/squads/invitations/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ invitationId: invitationIdToProcess }),
        }
      );
      
      const data = await response.json();
      if (response.ok) {
        toast.success(data.message || `Invitation ${action}ed!`);
        onMarkAsRead(notification.notificationId); // Mark as read after action
        // Parent panel (NotificationsPanel) will refetch notifications due to onMarkAsRead call
        if (action === 'accept' && notification.relatedSquadId) {
          router.push(`/squads/${notification.relatedSquadId}`);
        }
      } else {
        toast.error(data.error || `Failed to ${action} invitation`);
      }
    } catch (err) {
      toast.error(`An error occurred while ${action}ing the invitation`);
      console.error(err);
    }
    setIsProcessing(null);
  };

  const itemContent = (
    <div 
      className={`p-3 flex items-start hover:bg-gray-700/70 ${notification.isRead ? 'opacity-60' : 'opacity-100'} ${notification.ctaUrl ? 'cursor-pointer' : ''}`}
      onClick={handleNotificationClick} // Handles mark as read and navigation if ctaUrl exists
    >
      <div className="flex-shrink-0 mt-1">
        {getIconForNotificationType(notification.type)}
      </div>
      <div className="flex-grow ml-3">
        <p className={`text-sm font-semibold ${notification.isRead ? 'text-gray-400' : 'text-gray-100'}`}>
          {notification.title}
        </p>
        <p className={`text-sm ${notification.isRead ? 'text-gray-500' : 'text-gray-300'}`}>
          {notification.message}
        </p>
        {notification.relatedQuestTitle && (
          <p className="text-xs text-blue-400 mt-0.5">Quest: {notification.relatedQuestTitle}</p>
        )}
        {notification.reward_details_summary && !notification.rewardAmount && (
          <p className="text-xs text-green-400 mt-0.5">Reward: {notification.reward_details_summary}</p>
        )}
        {notification.rewardAmount && (
            <p className="text-xs text-green-400 mt-0.5">Reward: {notification.rewardAmount} {notification.rewardCurrency || ''}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">{timeAgo(notification.createdAt)}</p>

        {notification.type === 'squad_invite_received' && (
          <div className="mt-2 flex space-x-2">
            <button 
              onClick={(e) => handleInviteAction(e, 'accept')}
              disabled={isProcessing === 'accept'}
              className="px-3 py-1 text-xs bg-green-500 hover:bg-green-600 text-white font-semibold rounded-md disabled:opacity-70"
            >
              {isProcessing === 'accept' ? 'Accepting...' : 'Accept'}
            </button>
            <button 
              onClick={(e) => handleInviteAction(e, 'decline')}
              disabled={isProcessing === 'decline'}
              className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white font-semibold rounded-md disabled:opacity-70"
            >
              {isProcessing === 'decline' ? 'Declining...' : 'Decline'}
            </button>
          </div>
        )}
      </div>
      {!notification.isRead && (
        <div className="ml-2 flex-shrink-0 self-start mt-1">
          <span className="w-2 h-2 bg-blue-500 rounded-full inline-block"></span>
        </div>
      )}
    </div>
  );

  // If ctaUrl is present and it's not a squad invite (which has its own buttons), wrap with Link.
  // Squad invites are handled by their buttons, and the whole item click marks as read/navigates if ctaUrl is generic.
  if (notification.ctaUrl && notification.type !== 'squad_invite_received') {
    return (
      <Link href={notification.ctaUrl} className="block w-full">
        {itemContent}
      </Link>
    );
  }

  return itemContent;
};

export default NotificationItem; 