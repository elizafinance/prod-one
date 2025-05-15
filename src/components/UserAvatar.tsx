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
  
  let initialUrl = profileImageUrl || '';
  // Clean up protocol
  if (initialUrl.startsWith('http:')) {
    initialUrl = initialUrl.replace('http:', 'https:');
  }

  const cacheBusted = initialUrl ? `${initialUrl}${initialUrl.includes('?') ? '&' : '?'}cb=${Date.now()}` : '';

  const [imageSrc, setImageSrc] = useState<string>(cacheBusted);

  const handleImgError = () => {
    if (imageSrc && imageSrc.includes('_bigger')) {
      const normalUrl = imageSrc.replace('_bigger', '_normal');
      setImageSrc(normalUrl);
    } else {
      setImageError(true);
    }
  };

  const imageUrl = (!profileImageUrl || imageError || imageSrc === '') ? null : imageSrc;

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
          onError={handleImgError}
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