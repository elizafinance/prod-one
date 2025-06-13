"use client";

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';

interface VerifyFollowButtonProps {
  linkedXUsername: string | null | undefined;
  onFollowStatusChange?: (follows: boolean) => void;
  // We can pass followsDefAIRewards to show an initial status text if needed,
  // but the button primarily triggers a new check.
}

export default function VerifyFollowButton({ linkedXUsername, onFollowStatusChange }: VerifyFollowButtonProps) {
  const { status, update: updateSession } = useSession();
  const [isVerifyingFollow, setIsVerifyingFollow] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<number>(0);
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number>(0);

  const handleVerifyFollow = async () => {
    if (!linkedXUsername) { // Should not happen if button is only rendered when linked
      toast.error("X account not linked.");
      return;
    }

    // Check if we're still rate limited
    const now = Date.now();
    if (rateLimitedUntil > now) {
      const waitMinutes = Math.ceil((rateLimitedUntil - now) / (60 * 1000));
      toast.warning(`Please wait ${waitMinutes} more minute(s) before trying again.`);
      return;
    }

    // Prevent rapid clicking (minimum 10 seconds between attempts)
    if (now - lastAttempt < 10000) {
      const waitSeconds = Math.ceil((10000 - (now - lastAttempt)) / 1000);
      toast.warning(`Please wait ${waitSeconds} more second(s) before trying again.`);
      return;
    }

    setLastAttempt(now);
    setIsVerifyingFollow(true);
    
    try {
      const response = await fetch('/api/x/verify-follow', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        if (data.rateLimited || response.status === 429) {
          // Calculate when we can try again based on reset time
          if (data.retryAfter) {
            const resetTime = parseInt(data.retryAfter) * 1000;
            setRateLimitedUntil(resetTime);
            const waitMinutes = Math.ceil((resetTime - now) / (60 * 1000));
            toast.error(`X API rate limit reached. You can try again in ${waitMinutes} minute(s).`, {
              duration: 10000,
            });
          } else {
            toast.error("X API rate limit reached. Please wait 15 minutes before trying again.", {
              duration: 8000,
            });
            setRateLimitedUntil(now + 15 * 60 * 1000); // Default 15-minute wait
          }
        } else if (data.needsRelink) {
          // Provide specific messaging based on the reason
          let message = "Your X authentication has expired. Please re-link your X account.";
          if (data.reason === 'missing_refresh_token') {
            message = "Your X account was linked before our latest security updates. Please re-link your X account for better authentication.";
          } else if (data.reason === 'refresh_failed') {
            message = "Your X authentication has expired and couldn't be renewed. Please re-link your X account.";
          } else if (data.reason === 'token_corruption') {
            message = "Your X authentication data is corrupted. Please re-link your X account.";
          }
          
          toast.error(message, {
            duration: 8000,
          });
        } else if (response.status === 500 && data.error?.includes('Unauthorized')) {
          toast.error("X authentication failed. Please try re-linking your X account.", {
            duration: 5000,
          });
        } else {
          toast.error(data.error || "Failed to verify follow status.");
        }
        throw new Error(data.error || 'Verification failed');
      }

      // Update session to reflect the new follow status from the API response
      // The API returns { follows: boolean }, we need to update session.user.followsDefAIRewards
      await updateSession(); // This will re-fetch the session which now includes the updated followsDefAIRewards

      // Notify parent components of the follow status change
      if (onFollowStatusChange) {
        onFollowStatusChange(data.follows);
      }

      if (data.follows) {
        const message = data.cached 
          ? "✓ You are following @defAIRewards (cached result)"
          : "✓ Successfully verified: You are following @defAIRewards!";
        toast.success(message);
      } else {
        const message = data.cached
          ? "You are not currently following @defAIRewards (cached result). Please follow and try again in a few minutes."
          : "You are not currently following @defAIRewards. Please follow and try again.";
        toast.info(message);
      }



    } catch (error: any) {
      // Log error for debugging, but don't expose internal details to user
      console.error("[VerifyFollow] Error:", error.message || error);
      
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

  const now = Date.now();
  const isRateLimited = rateLimitedUntil > now;
  const isRecentlyAttempted = (now - lastAttempt) < 10000;
  const isDisabled = isVerifyingFollow || isRateLimited || isRecentlyAttempted;

  const getButtonText = () => {
    if (isVerifyingFollow) return 'Verifying Follow...';
    if (isRateLimited) {
      const waitMinutes = Math.ceil((rateLimitedUntil - now) / (60 * 1000));
      return `Rate Limited (${waitMinutes}m remaining)`;
    }
    if (isRecentlyAttempted) {
      const waitSeconds = Math.ceil((10000 - (now - lastAttempt)) / 1000);
      return `Wait ${waitSeconds}s`;
    }
    return 'Check/Refresh Follow Status for @defAIRewards';
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleVerifyFollow}
        disabled={isDisabled}
        className={`w-full px-4 py-2 text-xs font-medium rounded-md transition-colors ${
          isRateLimited 
            ? 'bg-orange-500 text-white cursor-not-allowed opacity-60'
            : isRecentlyAttempted
            ? 'bg-yellow-500 text-white cursor-not-allowed opacity-60'
            : 'text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-60'
        }`}
      >
        {getButtonText()}
      </button>
      
      <p className="text-xs text-gray-500 text-center">
        Having issues? Try <button 
          onClick={() => window.location.href = '/profile'} 
          className="text-blue-500 hover:text-blue-600 underline"
        >
          re-linking your X account
        </button>
      </p>
    </div>
  );
} 