"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

interface VerifyFollowButtonProps {
  linkedXUsername: string | null | undefined;
  // We can pass followsDefAIRewards to show an initial status text if needed,
  // but the button primarily triggers a new check.
}

export default function VerifyFollowButton({ linkedXUsername }: VerifyFollowButtonProps) {
  const { status, update: updateSession } = useSession();
  const [isVerifyingFollow, setIsVerifyingFollow] = useState(false);

  const handleVerifyFollow = async () => {
    if (!linkedXUsername) { // Should not happen if button is only rendered when linked
      toast.error("X account not linked.");
      return;
    }
    setIsVerifyingFollow(true);
    try {
      const response = await fetch('/api/x/verify-follow', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        if (data.needsRelink) {
          toast.error("Could not verify follow status. Please try re-linking your X account.");
        } else {
          toast.error(data.error || "Failed to verify follow status.");
        }
        throw new Error(data.error || 'Verification failed');
      }

      // Update session to reflect the new follow status from the API response
      // The API returns { follows: boolean }, we need to update session.user.followsDefAIRewards
      await updateSession(); // This will re-fetch the session which now includes the updated followsDefAIRewards

      if (data.follows) {
        toast.success(`Successfully verified: You are following @defAIRewards!`);
      } else {
        toast.info(`You are not currently following @defAIRewards. Please follow and try again.`);
      }

    } catch (error: any) {
      console.error("Error verifying X follow status:", error);
      if (!error.message.includes('Verification failed') && !error.message.includes('re-linking')) {
        toast.error("An unexpected error occurred while verifying follow status.");
      }
    } finally {
      setIsVerifyingFollow(false);
    }
  };

  // Only render if X account is linked
  if (!linkedXUsername || status === 'loading') {
    return null; 
  }
  
  if (status !== 'authenticated') { // Should ideally not happen if X is linked, but good check
      return <p className="text-xs text-gray-500">Log in to verify follow status.</p>;
  }

  return (
    <button
      onClick={handleVerifyFollow}
      disabled={isVerifyingFollow}
      className="w-full px-4 py-2 text-xs font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-60 transition-colors mt-2"
    >
      {isVerifyingFollow ? 'Verifying Follow...' : 'Check/Refresh Follow Status for @defAIRewards'}
    </button>
  );
} 