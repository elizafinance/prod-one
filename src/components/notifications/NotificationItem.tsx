"use client";

import { NotificationDocument } from "@/lib/mongodb"; // Assuming your type is in mongodb.ts
import Link from 'next/link';

interface NotificationItemProps {
  notification: NotificationDocument;
  onMarkAsRead: (notificationId: string) => void; // Callback to mark as read
}

// Basic icons (replace with actual icon components if you have them)
const SquadIcon = () => <span className="mr-2">🛡️</span>;
const UserIcon = () => <span className="mr-2">👤</span>;
const InfoIcon = () => <span className="mr-2">ℹ️</span>;

export default function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const getIcon = () => {
    if (notification.type.startsWith('squad_')) return <SquadIcon />;
    // Add more icon logic based on notification.type
    return <InfoIcon />;
  };

  const handleNotificationClick = () => {
    if (!notification.isRead) {
      onMarkAsRead(notification.notificationId);
    }
    // Optionally, navigate to a related link if available
    // e.g., if (notification.relatedSquadId) router.push(`/squads/${notification.relatedSquadId}`);
  };

  return (
    <li 
      className={`p-3 border-b border-gray-700 last:border-b-0 hover:bg-gray-700/50 cursor-pointer ${notification.isRead ? 'opacity-60' : 'bg-gray-700/20'}`}
      onClick={handleNotificationClick}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="flex-grow">
          <p className={`text-sm ${notification.isRead ? 'text-gray-400' : 'text-gray-100'}`}>
            {notification.message}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(notification.createdAt || Date.now()).toLocaleString()} 
            {/* Add link if relevant, e.g., to squad or user profile */}
            {/* {notification.relatedSquadId && 
              <Link href={`/squads/${notification.relatedSquadId}`} className="ml-2 text-blue-400 hover:underline">View Squad</Link>}
            */}
          </p>
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