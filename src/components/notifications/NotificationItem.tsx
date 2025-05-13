"use client";

import React, { useState } from 'react';
// import { NotificationDocument } from "@/lib/mongodb"; // Using UnifiedNotification
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FaGift, FaUsers, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa'; // Example icons

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

// Re-use NotificationDocument structure from lib/mongodb.ts, adapt for display
export interface NotificationDisplayData {
  _id?: any; // MongoDB ObjectId
  notificationId: string; 
  recipientWalletAddress: string; 
  type: string; // NotificationType as string
  message: string; 
  relatedQuestId?: string;
  relatedQuestTitle?: string;
  reward_details_summary?: string;
  relatedSquadId?: string;
  relatedSquadName?: string; 
  relatedUserWalletAddress?: string; 
  relatedUserXUsername?: string; 
  relatedInvitationId?: string; 
  isRead: boolean;
  createdAt?: string; // ISO date string
}

interface NotificationItemProps {
  notification: NotificationDisplayData;
  onMarkAsRead: (notificationId: string) => Promise<void>; // Callback to mark as read
}

// Basic icons (replace with actual icon components if you have them)
const SquadIcon = () => <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white">S</div>;
const UserIcon = () => <span className="mr-2">👤</span>;
const InfoIcon = () => <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-white">i</div>;

const getIconForNotificationType = (type: string) => {
  if (type.includes('quest_reward')) return <FaGift className="text-green-400 mr-3 text-xl" />;
  if (type.includes('quest_completed')) return <FaCheckCircle className="text-blue-400 mr-3 text-xl" />;
  if (type.includes('quest')) return <FaUsers className="text-purple-400 mr-3 text-xl" />;
  if (type.includes('squad')) return <FaUsers className="text-teal-400 mr-3 text-xl" />;
  return <FaExclamationCircle className="text-yellow-400 mr-3 text-xl" />;
};

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onMarkAsRead }) => {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
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

  const handleNotificationClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.notificationId);
    }
    // Navigation logic can be added here if clicking the notification should redirect
    // For example, if relatedQuestId, navigate to /quests/[relatedQuestId]
  };

  const handleAcceptInvite = async (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (!notification.type.includes('squad') || !notification.relatedSquadId) return;
    
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
    e.stopPropagation(); 
    if (!notification.type.includes('squad')) return;

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

  const content = (
    <div 
      className={`p-3 flex items-start hover:bg-gray-700/70 cursor-pointer transition-colors ${notification.isRead ? 'opacity-70' : ''}`}
      onClick={handleNotificationClick}
    >
      <div className="flex-shrink-0 mt-1">
        {getIconForNotificationType(notification.type)}
      </div>
      <div className="flex-grow">
        <p className={`text-sm ${notification.isRead ? 'text-gray-400' : 'text-gray-100'}`}>
          {notification.message}
        </p>
        {notification.relatedQuestTitle && (
          <p className="text-xs text-blue-400 mt-0.5">Quest: {notification.relatedQuestTitle}</p>
        )}
        {notification.reward_details_summary && (
          <p className="text-xs text-green-400 mt-0.5">Reward: {notification.reward_details_summary}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">{timeAgo(notification.createdAt)}</p>
      </div>
      {!notification.isRead && (
        <div className="ml-2 flex-shrink-0 self-center">
          <span className="w-2.5 h-2.5 bg-blue-500 rounded-full inline-block"></span>
        </div>
      )}
    </div>
  );

  if (notification.relatedQuestId) {
    return (
      <Link href={`/quests/${notification.relatedQuestId}`} className="block w-full">
        {content}
      </Link>
    );
  }
  // Add other link types here, e.g., for squad invites, user profiles etc.

  return content; // Fallback for notifications that are not directly linkable for now
};

export default NotificationItem; 