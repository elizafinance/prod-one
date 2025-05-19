"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { toast } from 'sonner';
import DeFAILogo from '@/components/DeFAILogo';
import { Button } from '@/components/ui/button';
import OnboardingStepper from '@/components/onboarding/Stepper'; // Reuse stepper for auth/wallet prompts

export default function JoinSquadPage() {
  const router = useRouter();
  const params = useParams();
  const squadId = typeof params?.squadId === 'string' ? params.squadId : null;

  const { data: session, status: authStatus } = useSession();
  const { wallet, connected: isWalletConnected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Determine current onboarding step for this page context
  let currentLocalStep: 'login' | 'wallet' | 'processing' | 'done' = 'login';
  if (authStatus === 'authenticated') {
    if (isWalletConnected) {
      currentLocalStep = 'processing';
    } else {
      currentLocalStep = 'wallet';
    }
  }
  if (message || error) currentLocalStep = 'done';

  useEffect(() => {
    if (!squadId) {
      toast.error("Invalid squad link.");
      router.push('/squads/browse');
      return;
    }

    if (authStatus === 'authenticated' && isWalletConnected && !isLoading && !message && !error) {
      const processSquadJoin = async () => {
        setIsLoading(true);
        setMessage(null);
        setError(null);
        try {
          // Using the existing API endpoint for processing squad link invites
          // This endpoint expects the squadId in the body
          const res = await fetch("/api/squads/invitations/process-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ squadId }), // squadId from URL param
          });
          const data = await res.json();

          if (res.ok) {
            toast.success(data.message || "Successfully processed squad invitation!");
            setMessage(data.message || "Successfully processed squad invitation!");
            // Redirect to the squad page after a short delay
            setTimeout(() => {
              router.push(`/squads/${squadId}`);
            }, 2000);
          } else {
            toast.error(data.error || "Failed to process squad invitation.");
            setError(data.error || "Failed to process squad invitation. You might already be a member or the squad is full.");
          }
        } catch (err) {
          console.error("[JoinSquadPage] Error processing squad join:", err);
          toast.error("An unexpected error occurred.");
          setError("An unexpected error occurred while trying to join the squad.");
        } finally {
          setIsLoading(false);
        }
      };
      processSquadJoin();
    }
  }, [squadId, authStatus, isWalletConnected, router, isLoading, message, error]);

  if (authStatus === 'loading') {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-slate-900 text-white">
        <DeFAILogo className="h-20 w-20 mb-6 animate-pulse" />
        <p className="font-orbitron text-xl">Loading session...</p>
      </main>
    );
  }
  
  if (currentLocalStep !== 'processing' && currentLocalStep !== 'done') {
    return (
        <main className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <div className="flex flex-col items-center mb-8 text-center">
            <DeFAILogo className="h-16 w-16 sm:h-20 sm:w-20 mb-4" />
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-orbitron font-bold">Joining Squad</h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-xs sm:max-w-sm mt-2">
                Please complete these steps to join the squad.
            </p>
            </div>
            <OnboardingStepper 
                currentMajorStep={currentLocalStep as ('login' | 'wallet')} 
                onLogin={() => signIn('twitter')} 
                onConnectWallet={() => setWalletModalVisible(true)}
                isWalletConnected={isWalletConnected}
            />
        </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-slate-900 text-white">
      <DeFAILogo className="h-20 w-20 mb-6" />
      {isLoading && (
        <>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400 mb-4"></div>
          <p className="text-xl font-semibold">Processing your request to join squad...</p>
        </>
      )}
      {message && (
        <>
          <p className="text-xl font-semibold text-green-400 mb-2">Success!</p>
          <p className="text-center mb-4">{message}</p>
          <p className="text-sm">Redirecting you to the squad page shortly...</p>
        </>
      )}
      {error && (
        <>
          <p className="text-xl font-semibold text-red-400 mb-2">Error</p>
          <p className="text-center mb-4">{error}</p>
          <Button onClick={() => router.push('/squads/browse')} className="bg-blue-500 hover:bg-blue-600 text-white">
            Browse Other Squads
          </Button>
        </>
      )}
    </main>
  );
} 