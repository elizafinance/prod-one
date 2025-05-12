'use client';

import React from 'react';
import Image from 'next/image';

interface UserAvatarProps {
  profileImageUrl?: string | null;
  username?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ 
  profileImageUrl, 
  username, 
  size = 'md',
  className = '',
}) => {
  // Size mapping for avatar dimensions
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-16 w-16'
  };

  const sizeClass = sizeMap[size];
  
  // Get first letter of username for fallback
  const fallbackText = username ? username.charAt(0).toUpperCase() : '?';
  
  // Replace Twitter's _normal with _bigger to get higher resolution avatar
  let optimizedImageUrl = profileImageUrl;
  if (profileImageUrl && profileImageUrl.includes('_normal.')) {
    optimizedImageUrl = profileImageUrl.replace('_normal.', '_bigger.');
  }

  return (
    <div className={`${sizeClass} relative rounded-full overflow-hidden flex items-center justify-center bg-gray-200 ${className}`}>
      {optimizedImageUrl ? (
        <Image 
          src={optimizedImageUrl}
          alt={`${username || 'User'}'s avatar`}
          fill
          className="object-cover"
        />
      ) : (
        <span className="text-gray-700 font-bold">
          {fallbackText}
        </span>
      )}
    </div>
  );
};

export default UserAvatar; 