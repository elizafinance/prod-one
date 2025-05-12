'use client';

import React, { useState } from 'react';
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
  const [imageError, setImageError] = useState(false);
  
  // Size mapping for avatar dimensions
  const sizeMap = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-16 w-16'
  };

  const sizeClass = sizeMap[size];
  
  // Get first letter of username for fallback
  const fallbackText = username ? username.charAt(0).toUpperCase() : '?';
  
  // Process Twitter image URL to make it more reliable
  let optimizedImageUrl = profileImageUrl || '';
  
  // Only process if there's an actual URL
  if (optimizedImageUrl) {
    // Replace '_normal' with '_bigger' for higher resolution
    if (optimizedImageUrl.includes('_normal.')) {
      optimizedImageUrl = optimizedImageUrl.replace('_normal.', '_bigger.');
    }
    
    // Convert http to https if needed
    if (optimizedImageUrl.startsWith('http:')) {
      optimizedImageUrl = optimizedImageUrl.replace('http:', 'https:');
    }
    
    // Add cache-busting parameter to avoid CORS issues with Twitter
    optimizedImageUrl = `${optimizedImageUrl}${optimizedImageUrl.includes('?') ? '&' : '?'}cb=${Date.now()}`;
  }

  // Set up a clean public profile image URL for NextJS Image to use
  const imageUrl = (!profileImageUrl || imageError || optimizedImageUrl === '') ? null : optimizedImageUrl;

  return (
    <div className={`${sizeClass} relative rounded-full overflow-hidden flex items-center justify-center bg-gray-200 ${className}`}>
      {imageUrl ? (
        // Using next/image with unoptimized to avoid issues with Twitter's image server
        <Image 
          src={imageUrl}
          alt={`${username || 'User'}'s avatar`}
          fill
          unoptimized
          className="object-cover"
          onError={() => setImageError(true)}
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