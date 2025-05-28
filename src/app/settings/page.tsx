"use client";

import CrossmintLoginButton from '@/components/CrossmintLoginButton';
import { useSession } from "next-auth/react";
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';

export default function SettingsPage() {
  const { data: session, status } = useSession();

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 bg-background text-foreground">
      <div className="w-full max-w-md p-8 space-y-8 bg-card rounded-lg shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-orbitron font-bold text-primary">Settings</h1>
          <p className="mt-2 text-muted-foreground">Manage your account and connected services.</p>
        </div>

        <div className="space-y-6">
          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-3 text-card-foreground">Wallet Connection</h2>
            <p className="text-sm text-muted-foreground mb-4">Manage your primary Solana wallet connection.</p>
            <WalletMultiButton />
          </div>

          <div className="p-6 border rounded-lg">
            <h2 className="text-xl font-semibold mb-3 text-card-foreground">Crossmint Account</h2>
            {status === "authenticated" && session?.user?.email ? (
              <div>
                <p className="text-sm text-muted-foreground mb-2">You are connected with Crossmint using:</p>
                <p className="font-medium text-primary">{session.user.email}</p>
                {/* Optionally, add a disconnect button here if your Crossmint setup allows it */}
              </div>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground mb-4">Connect your Crossmint account to manage NFTs seamlessly across different blockchains.</p>
                <CrossmintLoginButton />
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/" legacyBehavior>
            <a className="text-sm text-primary hover:underline">Back to Home</a>
          </Link>
        </div>
      </div>
    </main>
  );
} 