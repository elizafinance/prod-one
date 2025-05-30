"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import ConnectXButton from '@/components/xauth/ConnectXButton';
import VerifyFollowButton from '@/components/xauth/VerifyFollowButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { WalletIcon, LinkIcon, CheckCircleIcon, XCircleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline'; // Example icons

// A simple X/Twitter icon component
const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg fill="currentColor" viewBox="0 0 24 24" aria-hidden="true" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function ProfilePage() {
  const { data: session, status, update: updateSession } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    if (!searchParams) return;
    const xConnectSuccess = searchParams.get('x_connect_success');
    const xConnectError = searchParams.get('x_connect_error');
    let messageDisplayed = false;

    if (xConnectSuccess === 'true') {
      toast.success("X account linked successfully!");
      updateSession();
      messageDisplayed = true;
    } else if (xConnectError) {
      let errorMessage = "Failed to link X account. Please try again.";
      if (xConnectError === 'config') errorMessage = "X connection is not configured correctly on the server.";
      else if (xConnectError === 'auth') errorMessage = "Authentication failed or user details missing. Please log in and try again.";
      else if (xConnectError === 'missing_params') errorMessage = "OAuth parameters missing. Please try again.";
      else if (xConnectError === 'state_mismatch') errorMessage = "Invalid request (state mismatch). Please try again.";
      else if (xConnectError === 'no_code') errorMessage = "Authorization code not received from X. Please try again.";
      else if (xConnectError.length < 40 && xConnectError.length > 0) errorMessage = `Error linking X: ${xConnectError.replace(/_/g, ' ')}.`;
      toast.error(errorMessage);
      messageDisplayed = true;
    }

    if (messageDisplayed) {
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete('x_connect_success');
      newSearchParams.delete('x_connect_error');
      const newUrl = `${window.location.pathname}${newSearchParams.toString() ? '?' + newSearchParams.toString() : ''}`;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, updateSession, router]);

  const handleDisconnectX = async () => {
    if (!confirm("Are you sure you want to disconnect your X account? This will remove its link to your profile and may affect feature access.")) {
      return;
    }
    setIsDisconnecting(true);
    try {
      const response = await fetch('/api/x/connect/disconnect', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to disconnect X account.");
      }
      toast.success("X account disconnected successfully.");
      await updateSession(); 
    } catch (error: any) {
      console.error("Error disconnecting X account:", error);
      toast.error(error.message || "Could not disconnect X account.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (status === 'loading') {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <p className="text-lg text-gray-600">Loading profile...</p>
            {/* You could add a spinner here */}
        </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
            <p className="text-lg text-red-600">Please log in to view your profile.</p>
            {/* Maybe a login button? */}
        </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
      <div className="text-center sm:text-left">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Your Profile
        </h1>
        <p className="mt-3 text-lg text-gray-500">
          Manage your account settings and connected services.
        </p>
      </div>
      
      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center space-x-3">
          <WalletIcon className="h-8 w-8 text-blue-600" />
          <div>
            <CardTitle className="text-2xl">Wallet Information</CardTitle>
            <CardDescription className="mt-1">Your primary connected wallet for DeFAI Rewards.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {session.user.walletAddress ? (
            <div className="flex items-center space-x-2">
              <strong className="text-gray-700">Address:</strong> 
              <span className="font-mono text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded break-all">{session.user.walletAddress}</span>
            </div>
          ) : (
            <p className="text-gray-500">Wallet not connected.</p>
          )}
          {session.user.chain && (
            <div className="flex items-center space-x-2">
              <strong className="text-gray-700">Chain:</strong> 
              <span className="text-gray-600 capitalize bg-gray-100 px-2 py-1 rounded">{session.user.chain}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center space-x-3">
          <TwitterIcon className="h-8 w-8 text-sky-500" />
          <div>
            <CardTitle className="text-2xl">X Account Connection</CardTitle>
            <CardDescription className="mt-1">
              Link your X account to verify social tasks, earn bonuses, and unlock specific features.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <ConnectXButton /> 
          
          {session.user.linkedXUsername && (
            <VerifyFollowButton linkedXUsername={session.user.linkedXUsername} />
          )}

          {session.user.linkedXUsername && (
            <Button 
              variant="destructive" // Use destructive variant for more semantic styling
              size="sm"
              onClick={handleDisconnectX} 
              disabled={isDisconnecting}
              className="w-full mt-6 text-sm" // Added more top margin
            >
              {isDisconnecting ? 'Disconnecting X Account...' : 'Disconnect X Account'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Placeholder for future sections */}
      {/* 
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Referral Program</CardTitle>
          <CardDescription>View your referral statistics and share your link.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Referral information coming soon...</p>
        </CardContent>
      </Card>
      */}
    </div>
  );
} 