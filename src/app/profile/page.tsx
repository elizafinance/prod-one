"use client";

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Wallet, Twitter, User, Settings, Link as LinkIcon, Shield, CheckCircle, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import ConnectXButton from '@/components/xauth/ConnectXButton';
import VerifyFollowButton from '@/components/xauth/VerifyFollowButton';

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
      <SidebarInset>
        <div className="flex items-center justify-center min-h-screen">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3366FF]"></div>
          <p className='ml-3'>Loading profile...</p>
        </div>
      </SidebarInset>
    );
  }

  if (status === 'unauthenticated' || !session?.user) {
    return (
      <SidebarInset>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="text-lg text-destructive mb-4">Please log in to view your profile.</p>
          <Button>Login</Button>
        </div>
      </SidebarInset>
    );
  }

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Platform</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Profile</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <main className="flex-1 py-6">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6">
            {/* Profile Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-3xl">Your Profile</CardTitle>
                    <CardDescription>Manage your account settings and connected services</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={session.user.walletAddress ? 'default' : 'secondary'}>
                      {session.user.walletAddress ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Profile Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Wallet Status</CardTitle>
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {session.user.walletAddress ? 'Connected' : 'None'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Primary wallet
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Social Account</CardTitle>
                  <Twitter className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {session.user.linkedXUsername ? 'Linked' : 'None'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {session.user.linkedXUsername ? `@${session.user.linkedXUsername}` : 'No X account'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Chain</CardTitle>
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {session.user.chain || 'Unknown'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Blockchain network
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Verification</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {session.user.linkedXUsername ? 'Verified' : 'Pending'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Account status
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Wallet Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Wallet Information
                </CardTitle>
                <CardDescription>Your primary connected wallet for DeFAI Rewards</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {session.user.walletAddress ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Wallet Address</label>
                      <div className="mt-1 p-3 bg-accent rounded-lg">
                        <span className="font-mono text-sm break-all">{session.user.walletAddress}</span>
                      </div>
                    </div>
                    {session.user.chain && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Blockchain</label>
                        <div className="mt-1">
                          <Badge variant="outline" className="capitalize">{session.user.chain}</Badge>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No wallet connected</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* X Account Connection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Twitter className="h-5 w-5" />
                  X Account Connection
                </CardTitle>
                <CardDescription>
                  Link your X account to verify social tasks, earn bonuses, and unlock specific features
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ConnectXButton /> 
                
                {session.user.linkedXUsername && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-green-800">Connected as @{session.user.linkedXUsername}</span>
                    </div>
                    
                    <VerifyFollowButton linkedXUsername={session.user.linkedXUsername} />

                    <Button 
                      variant="destructive"
                      size="sm"
                      onClick={handleDisconnectX} 
                      disabled={isDisconnecting}
                      className="w-full"
                    >
                      <X className="h-4 w-4 mr-2" />
                      {isDisconnecting ? 'Disconnecting X Account...' : 'Disconnect X Account'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Account Security */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Account Security
                </CardTitle>
                <CardDescription>Manage your account security and verification status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Wallet className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Wallet Authentication</p>
                        <p className="text-sm text-muted-foreground">Secure wallet-based login</p>
                      </div>
                    </div>
                    <Badge className="bg-green-500">Active</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Twitter className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">Social Verification</p>
                        <p className="text-sm text-muted-foreground">X account verification</p>
                      </div>
                    </div>
                    <Badge variant={session.user.linkedXUsername ? 'default' : 'secondary'}>
                      {session.user.linkedXUsername ? 'Verified' : 'Not verified'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
} 