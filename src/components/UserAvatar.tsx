'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { UserCircleIcon } from '@heroicons/react/24/outline';

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
  
  const baseSizeMap = {
    sm: 8,
    md: 10,
    lg: 16
  };
  const dimension = baseSizeMap[size] * 4;

  const sizeClassMap = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-16 w-16'
  };
  const sizeClass = sizeClassMap[size];
  
  let initialUrl = profileImageUrl || '';
  if (initialUrl.startsWith('http:')) {
    initialUrl = initialUrl.replace('http:', 'https:');
  }

  const cacheBusted = initialUrl ? `${initialUrl}${initialUrl.includes('?') ? '&' : '?'}cb=${Date.now()}` : '';
  const [imageSrc, setImageSrc] = useState<string>(initialUrl);

  React.useEffect(() => {
    let currentSrc = profileImageUrl || '';
    if (currentSrc.startsWith('http:')) {
        currentSrc = currentSrc.replace('http:', 'https:');
    }
    // console.log("[UserAvatar DEBUG] useEffect - profileImageUrl prop:", profileImageUrl, "Setting imageSrc to:", currentSrc); // Commented out
    setImageSrc(currentSrc);
    setImageError(false);
  }, [profileImageUrl]);

  const handleImgError = () => {
    // console.log("[UserAvatar DEBUG] handleImgError called. current imageSrc:", imageSrc); // Commented out
    if (imageSrc && imageSrc.includes('_bigger')) {
      const normalUrl = imageSrc.replace('_bigger', '_normal');
      // console.log("[UserAvatar DEBUG] Trying normalUrl:", normalUrl); // Commented out
      setImageSrc(normalUrl);
    } else {
      // console.log("[UserAvatar DEBUG] Setting imageError to true.", "profileImageUrl was:", profileImageUrl); // Commented out
      setImageError(true);
    }
  };

  const showImage = profileImageUrl && imageSrc && !imageError;
  // console.log("[UserAvatar DEBUG] Rendering. profileImageUrl:", profileImageUrl, "imageSrc:", imageSrc, "imageError:", imageError, "showImage:", showImage); // Commented out

  return (
    <div 
      className={`relative rounded-full overflow-hidden flex items-center justify-center bg-gray-200 text-gray-500 ${sizeClass} ${className}`}
      aria-label={username ? `${username}'s avatar` : 'User avatar'}
    >
      {showImage ? (
        <Image 
          key={imageSrc}
          src={imageSrc}
          alt={username ? `${username}'s avatar` : 'User avatar'}
          fill
          unoptimized
          className="object-cover"
          onError={handleImgError}
        />
      ) : (
        <UserCircleIcon className={`text-gray-400 ${sizeClass}`} />
      )}
    </div>
  );
};

export default UserAvatar; 