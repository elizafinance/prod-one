"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck, ExternalLink, Inbox } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import NotificationItem, { NotificationDisplayData } from '@/components/notifications/NotificationItem';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';

interface NotificationsApiResponse {
  notifications: NotificationDisplayData[];
  unreadCount: number;
  currentPage: number;
  totalPages: number;
  totalNotifications: number;
}

const NOTIFICATIONS_PER_PAGE = 20; // Match default or allow config

export default function NotificationsHistoryPage() {
  const [notifications, setNotifications] = useState<NotificationDisplayData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { connected } = useWallet();

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAllNotifications = useCallback(async (pageToFetch = 1) => {
    if (!connected) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/notifications?page=${pageToFetch}&limit=${NOTIFICATIONS_PER_PAGE}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to fetch notifications');
      }
      const data: NotificationsApiResponse = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message);
      console.error("Error fetching all notifications:", err);
    } finally {
      setIsLoading(false);
    }
  }, [connected]);

  useEffect(() => {
    fetchAllNotifications(currentPage);
  }, [fetchAllNotifications, currentPage, connected]); // Add connected to re-fetch if wallet connects

  const handleMarkAsRead = async (notificationId: string): Promise<void> => {
    // Optimistically update UI. NotificationItem calls the API.
    setNotifications(prev => prev.map(n => 
      n.notificationId === notificationId ? { ...n, isRead: true } : n
    ));
    setUnreadCount(prev => Math.max(0, prev -1));
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to mark all notifications as read');
      }
      // const result = await response.json();
      // console.log(result.message);
      // alert(result.message); // Or use a toast notification
      // Refetch notifications to get the updated state from the server
      fetchAllNotifications(currentPage); 
    } catch (err: any) {
      console.error("Error in handleMarkAllAsRead:", err);
      setError(err.message || "Failed to mark all notifications as read.");
      setIsLoading(false); // Ensure loading is stopped on error
    }
    // setIsLoading(false) will be called by fetchAllNotifications in its finally block if successful
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  if (!connected && !isLoading) {
    return (
      <SidebarInset>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Bell className="h-12 w-12 text-muted-foreground mb-4" />
          <h1 className="text-3xl font-bold mb-2">Notifications</h1>
          <p className="text-muted-foreground mb-4">Please connect your wallet to view your notifications.</p>
        </div>
      </SidebarInset>
    );
  }

  if (isLoading && notifications.length === 0) {
    return (
      <SidebarInset>
        <div className="flex items-center justify-center min-h-screen">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#3366FF]"></div>
          <p className='ml-3'>Loading notifications...</p>
        </div>
      </SidebarInset>
    );
  }

  if (error) {
    return (
      <SidebarInset>
        <div className="flex flex-col items-center justify-center min-h-screen">
          <p className="text-lg text-destructive mb-4">Error: {error}</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </SidebarInset>
    );
  }

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="#">Platform</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Notifications</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto flex items-center gap-4 px-4">
          {unreadCount > 0 && (
            <Button 
              onClick={handleMarkAllAsRead}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark all read ({unreadCount})
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 py-6">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6 max-w-3xl mx-auto">
            {/* Page Header */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-3xl flex items-center gap-3">
                      <Bell className="h-8 w-8" />
                      Notifications
                    </CardTitle>
                    <CardDescription>Stay updated with your latest activities and achievements</CardDescription>
                  </div>
                  {unreadCount > 0 && (
                    <Badge variant="default">{unreadCount} unread</Badge>
                  )}
                </div>
              </CardHeader>
            </Card>

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Notifications</CardTitle>
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{notifications.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Current page
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Unread</CardTitle>
                  <Inbox className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{unreadCount}</div>
                  <p className="text-xs text-muted-foreground">
                    Requires attention
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Read</CardTitle>
                  <Check className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{notifications.length - unreadCount}</div>
                  <p className="text-xs text-muted-foreground">
                    Already viewed
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Notifications List */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Notifications</CardTitle>
                <CardDescription>Your latest updates and activity alerts</CardDescription>
              </CardHeader>
              <CardContent>
                {notifications.length === 0 && !isLoading ? (
                  <div className="text-center py-12">
                    <Inbox className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground text-lg mb-4">You have no notifications.</p>
                    <Button asChild>
                      <Link href="/quests">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Explore Quests
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.map(notif => (
                      <NotificationItem 
                        key={notif.notificationId} 
                        notification={notif} 
                        onMarkAsRead={handleMarkAsRead} 
                      />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)} 
                      disabled={currentPage === 1 || isLoading}
                    >
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).filter(pageNumber => 
                          pageNumber === 1 || pageNumber === totalPages || 
                          (pageNumber >= currentPage -1 && pageNumber <= currentPage + 1) ||
                          (currentPage <=3 && pageNumber <=3) ||
                          (currentPage >= totalPages - 2 && pageNumber >= totalPages -2)
                      ).map((pageNumber, index, arr) => (
                          <React.Fragment key={pageNumber}>
                              {index > 0 && arr[index-1] !== pageNumber -1 && <span className="text-muted-foreground px-1">...</span>}
                              <Button
                                  variant={currentPage === pageNumber ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handlePageChange(pageNumber)} 
                                  disabled={isLoading}
                              >
                                  {pageNumber}
                              </Button>
                          </React.Fragment>
                      ))}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)} 
                      disabled={currentPage === totalPages || isLoading}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
} 