"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

export default function ConnectXButton() {
  const { data: session, status, update: updateSession } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const handleConnectX = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/x/connect/initiate');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate X connection. Please try again.');
      }
      const data = await response.json();
      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        throw new Error('Authorization URL not received from server.');
      }
    } catch (error: any) {
      console.error("Error connecting X account:", error);
      toast.error(error.message || 'Could not connect X account.');
      setIsLoading(false);
    }
    // No setIsLoading(false) here because of page redirect
  };

  if (status === 'loading') {
    return (
      <div className="px-4 py-2 text-sm font-medium text-gray-500 bg-gray-100 rounded-md animate-pulse w-full text-center">
        Loading X Status...
      </div>
    );
  }

  if (session?.user?.linkedXUsername) {
    return (
      <div className="w-full text-sm">
        <div className="flex items-center justify-between mb-1">
            <p className="text-gray-700">
            X Account: 
            <a 
                href={`https://x.com/${session.user.linkedXUsername}`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="font-semibold text-blue-600 hover:underline ml-1"
            >
                @{session.user.linkedXUsername}
            </a>
            </p>
        </div>
        
        {session.user.followsDefAIRewards === true && (
            <p className="text-xs text-green-600 font-medium">✓ Following @defAIRewards</p>
        )}
        {session.user.followsDefAIRewards === false && (
            <p className="text-xs text-red-600 font-medium">✗ Not following @defAIRewards</p>
        )}
        {session.user.followsDefAIRewards === null && (
            <p className="text-xs text-yellow-600 font-medium">Follow status for @defAIRewards not yet checked.</p>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleConnectX}
      disabled={isLoading || status !== 'authenticated'}
      className="w-full px-4 py-2 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors flex items-center justify-center space-x-2"
    >
      <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      <span>{isLoading ? 'Connecting...' : 'Connect X Account'}</span>
    </button>
  );
} 