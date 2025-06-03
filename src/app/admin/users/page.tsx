"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Document, ObjectId } from 'mongodb';
import { Users, Shield, UserPlus, Trash2, Eye, Search, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import UserDetailsModal from '@/components/admin/UserDetailsModal';
import ConfirmationModal from '@/components/admin/ConfirmationModal';
import CreateUserModal from '@/components/admin/CreateUserModal';

export interface UserRow {
  _id?: string | ObjectId;
  walletAddress?: string;
  xUsername?: string;
  points?: number;
  role?: string;
  squadId?: string;
}

export interface AdminAuditLog extends Document {
  timestamp: Date;
  adminUserId: string;
  action: string;
  targetEntityType: string;
  targetEntityId: string;
  changes?: any;
  reason?: string;
  ipAddress?: string;
}

export interface ActionLogEntry {
    _id: string | ObjectId;
    walletAddress: string;
    actionType: string;
    pointsAwarded?: number;
    timestamp: Date;
    notes?: string;
}

export interface NotificationLogEntry {
    _id: string | ObjectId;
    userId: string | ObjectId;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: Date;
    ctaUrl?: string;
}

export interface FullUserDetail extends UserRow {
    _id?: string | ObjectId;
    referralCode?: string;
    referredBy?: string;
    completedActions?: string[];
    createdAt?: Date;
    updatedAt?: Date;
    recentActions?: ActionLogEntry[];
    recentNotifications?: NotificationLogEntry[];
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<FullUserDetail | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State for purge confirmation modal
  const [isPurgeConfirmModalOpen, setIsPurgeConfirmModalOpen] = useState(false);
  const [userToPurge, setUserToPurge] = useState<UserRow | null>(null);
  const [isPurging, setIsPurging] = useState(false);

  // New state for filters
  const [roleFilter, setRoleFilter] = useState('');
  const [squadIdFilter, setSquadIdFilter] = useState('');
  const [hasSquadFilter, setHasSquadFilter] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(25);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchUsers = useCallback(async (pageToFetch = 1) => {
    setLoading(true);
    let apiUrl = `/api/admin/users?q=${encodeURIComponent(query)}&page=${pageToFetch}&limit=${limit}`;
    if (roleFilter) apiUrl += `&role=${roleFilter}`;
    if (squadIdFilter) apiUrl += `&squadId=${encodeURIComponent(squadIdFilter)}`;
    if (hasSquadFilter) apiUrl += `&hasSquad=${hasSquadFilter}`;

    try {
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (res.ok) {
        setUsers(data.users || []);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(data.currentPage || 1);
      } else {
        toast.error(data.error || 'Failed to fetch users');
        setUsers([]);
        setTotalPages(1);
        setCurrentPage(1);
      }
    } catch (err) {
      toast.error('Error fetching users');
      console.error(err);
      setUsers([]);
      setTotalPages(1);
      setCurrentPage(1);
    }
    setLoading(false);
  }, [query, limit, roleFilter, squadIdFilter, hasSquadFilter, setLoading, setUsers, setTotalPages, setCurrentPage]);

  // This useEffect handles fetching based on filters, pagination, and auth status
  useEffect(() => {
    if (status !== 'authenticated') return;
    const userRoleAuth = (session?.user as any)?.role;
    if (userRoleAuth !== 'admin') return;
    fetchUsers(currentPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, (session?.user as any)?.role, query, roleFilter, squadIdFilter, hasSquadFilter, currentPage, limit, fetchUsers]);

  // This useEffect is for session-specific actions, now correctly using memoized fetchUsers
  useEffect(() => {
    if (session?.user && typeof fetchUsers === 'function') {
      // Consider if this initial call is truly needed given the other useEffect
      // fetchUsers(); 
    }
  }, [session?.user, fetchUsers]);

  // Opens the confirmation modal
  const initiatePurge = (user: UserRow) => {
    if (!user || (!user.walletAddress && !user._id)) {
      toast.error('Cannot purge user: No identifier (wallet or ID) found.');
      return;
    }
    setUserToPurge(user);
    setIsPurgeConfirmModalOpen(true);
  };

  // Actual purge logic, called on confirm from modal
  const executePurge = async () => {
    if (!userToPurge || (!userToPurge.walletAddress && !userToPurge._id)) return;

    setIsPurging(true);
    try {
      let deleteUrl = '/api/admin/users';
      if (userToPurge.walletAddress) {
        deleteUrl += `?wallet=${encodeURIComponent(userToPurge.walletAddress)}`;
      } else if (userToPurge._id) {
        deleteUrl += `?id=${encodeURIComponent(userToPurge._id.toString())}`;
      }

      const res = await fetch(deleteUrl, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success(`User ${userToPurge.xUsername || userToPurge.walletAddress?.substring(0,6) || ''} purged`);
        fetchUsers(); // Refresh the user list
      } else {
        toast.error(data.error || 'Failed to purge user');
      }
    } catch (err) {
      toast.error('Error purging user');
      console.error(err);
    }
    setIsPurging(false);
    setIsPurgeConfirmModalOpen(false);
    setUserToPurge(null);
  };

  const handleViewDetails = async (identifier: string) => {
    try {
      let apiUrl = '';
      const isLikelyObjectId = /^[a-f0-9]{24}$/i.test(identifier);

      if (isLikelyObjectId && !identifier.startsWith('0x')) { // Check if it's likely an ObjectId and not a wallet
        apiUrl = `/api/admin/users/id/${identifier}`;
      } else {
        apiUrl = `/api/admin/users/${identifier}`;
      }
      
      const res = await fetch(apiUrl);
      const data = await res.json(); // data = { user: UserDoc, recentActions: ..., recentNotifications: ... }
      if (res.ok && data.user) {
        // Flatten the structure to match FullUserDetail interface
        const fullDetail: FullUserDetail = {
          ...(data.user as any), // Spread all fields from the user document
          recentActions: data.recentActions,
          recentNotifications: data.recentNotifications,
        };
        setSelectedUser(fullDetail);
        setIsModalOpen(true);
      } else {
        toast.error(data.error || 'Failed to fetch user details');
      }
    } catch (err) {
      toast.error('Error fetching user details');
      console.error(err);
    }
  };

  const handleUserUpdate = (updatedUser: FullUserDetail) => {
    setUsers(prevUsers => 
      prevUsers.map(user => 
        (user._id === updatedUser._id || user.walletAddress === updatedUser.walletAddress) ? { ...user, ...updatedUser } : user
      )
    );
    // Optionally, if the modal is still open with this user, update selectedUser as well
    if (selectedUser && (selectedUser._id === updatedUser._id || selectedUser.walletAddress === updatedUser.walletAddress)) {
      setSelectedUser(prevSelected => prevSelected ? { ...prevSelected, ...updatedUser } : null);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
    // fetchUsers(); // Replaced by local update via handleUserUpdate, or can be kept if full refresh is desired after any modal interaction
  };

  const handleFilterChange = () => {
    setCurrentPage(1); // Reset to page 1 when filters change
    // fetchUsers(1); // useEffect will trigger this due to filter state change
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // fetchUsers(newPage); // useEffect will trigger this due to currentPage change
    }
  };

  const handleUserCreated = (newUser: UserRow) => {
    // Prepend new user to list
    setUsers(prev => [newUser, ...prev]);
  };

  const userRole = (session?.user as any)?.role;
  if (status === 'loading') return <p className="p-10">Loading session...</p>;
  if (status !== 'authenticated' || userRole !== 'admin') {
    return <p className="p-10 text-red-600">Access denied</p>;
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
                <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Users</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="ml-auto flex items-center gap-4 px-4">
          <Button onClick={() => setIsCreateModalOpen(true)} className="bg-[#3366FF] hover:bg-[#2952cc]">
            <UserPlus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        </div>
      </header>

      <main className="flex-1 py-6">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6">
            {/* Page Header */}
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl flex items-center gap-3">
                  <Users className="h-8 w-8" />
                  User Management
                </CardTitle>
                <CardDescription>
                  Manage user accounts, roles, and permissions
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{users.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Current page
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</div>
                  <p className="text-xs text-muted-foreground">
                    With admin role
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Squad Members</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{users.filter(u => u.squadId).length}</div>
                  <p className="text-xs text-muted-foreground">
                    Have squad membership
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Page {currentPage}</CardTitle>
                  <Filter className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalPages}</div>
                  <p className="text-xs text-muted-foreground">
                    Total pages
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Filter Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Search & Filters
                </CardTitle>
                <CardDescription>Filter users by various criteria</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="searchQuery" className="block text-sm font-medium mb-1">Search Wallet/Username/Email/ID</label>
                    <input
                      id="searchQuery"
                      type="text"
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); handleFilterChange(); }}
                      placeholder="Wallet, X Username, Email or ID"
                      className="w-full p-2 border rounded-md"
                    />
                  </div>
                  <div>
                    <label htmlFor="roleFilter" className="block text-sm font-medium mb-1">Role</label>
                    <select 
                      id="roleFilter" 
                      value={roleFilter} 
                      onChange={(e) => { setRoleFilter(e.target.value); handleFilterChange(); }}
                      className="w-full p-2 border rounded-md bg-white"
                    >
                      <option value="">All Roles</option>
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="squadIdFilter" className="block text-sm font-medium mb-1">Squad ID</label>
                    <input
                      id="squadIdFilter"
                      type="text"
                      value={squadIdFilter}
                      onChange={(e) => { setSquadIdFilter(e.target.value); handleFilterChange(); }}
                      placeholder="Enter exact Squad ID"
                      className="w-full p-2 border rounded-md"
                      disabled={hasSquadFilter === 'false' || hasSquadFilter === 'true'}
                    />
                  </div>
                  <div>
                    <label htmlFor="hasSquadFilter" className="block text-sm font-medium mb-1">Has Squad?</label>
                    <select 
                      id="hasSquadFilter" 
                      value={hasSquadFilter} 
                      onChange={(e) => { setHasSquadFilter(e.target.value); setSquadIdFilter(''); handleFilterChange(); }}
                      className="w-full p-2 border rounded-md bg-white"
                    >
                      <option value="">Any</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Table */}
            <Card>
              <CardHeader>
                <CardTitle>User List</CardTitle>
                <CardDescription>Manage and review user accounts</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#3366FF]"></div>
                    <p className="ml-2 text-muted-foreground">Loading users...</p>
                  </div>
                ) : (
                  <div>
                    <div className="overflow-x-auto">
                    <table className="w-full border text-sm table-auto">
                      <thead>
                        <tr className="bg-muted text-left">
                          <th className="p-3 font-medium">ID</th>
                          <th className="p-3 font-medium">Wallet</th>
                          <th className="p-3 font-medium">Username</th>
                          <th className="p-3 font-medium">Points</th>
                          <th className="p-3 font-medium">Squad</th>
                          <th className="p-3 font-medium">Role</th>
                          <th className="p-3 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((u) => {
                          const displayId = (u._id as any)?.toString() || 'N/A';
                          const idForOps = u.walletAddress || displayId;

                          return (
                            <tr key={idForOps || Math.random().toString()} className="border-t hover:bg-accent/5 transition-colors">
                              <td className="p-3 font-mono truncate max-w-xs" title={displayId}>{displayId.substring(0,8)}...</td>
                              <td className="p-3 font-mono truncate max-w-xs" title={u.walletAddress}>{u.walletAddress || '-'}</td>
                              <td className="p-3 truncate max-w-xs">{u.xUsername || '-'}</td>
                              <td className="p-3 text-right font-medium">{u.points?.toLocaleString() || 0}</td>
                              <td className="p-3 truncate max-w-xs" title={u.squadId}>{u.squadId || '-'}</td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  u.role === 'admin' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {u.role || 'user'}
                                </span>
                              </td>
                              <td className="p-3 whitespace-nowrap space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => idForOps && handleViewDetails(idForOps)}
                                  disabled={!idForOps}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Details
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => initiatePurge(u)}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Purge
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                        {users.length === 0 && (
                          <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No users found matching your criteria.</td></tr>
                        )}
                      </tbody>
                    </table>
                    </div>
                    {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="mt-6 flex justify-center items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>
                        First
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                        Prev
                      </Button>
                      <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                        Next
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages}>
                        Last
                      </Button>
                    </div>
                  )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {isModalOpen && selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          isOpen={isModalOpen}
          onClose={handleModalClose}
          onUserUpdate={handleUserUpdate}
        />
      )}
      {/* Render the ConfirmationModal */}
      {isPurgeConfirmModalOpen && userToPurge && (
        <ConfirmationModal
          isOpen={isPurgeConfirmModalOpen}
          onClose={() => {
            setIsPurgeConfirmModalOpen(false);
            setUserToPurge(null);
          }}
          onConfirm={executePurge}
          title="Confirm User Purge"
          message={
            <p>
              Are you sure you want to purge user{' '}
              <strong className="font-mono">{userToPurge.xUsername || userToPurge.walletAddress?.substring(0, 8) || ''}...</strong>?
              This action cannot be undone.
            </p>
          }
          confirmButtonText="Purge User"
          isConfirming={isPurging}
        />
      )}
      {isCreateModalOpen && (
        <CreateUserModal isOpen={isCreateModalOpen} onClose={()=>setIsCreateModalOpen(false)} onUserCreated={handleUserCreated} />
      )}
    </SidebarInset>
  );
} 