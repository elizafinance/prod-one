"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Shield, Search, Calendar, User, Activity, Target } from "lucide-react";
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
import { AdminAuditLog } from '@/app/admin/users/page'; // Re-using interface from users page for now

// Define a more specific type for the logs displayed if needed, or use AdminAuditLog directly
interface DisplayAuditLog extends AdminAuditLog {}

export default function AdminAuditLogsPage() {
  const { data: session, status } = useSession();
  const [logs, setLogs] = useState<DisplayAuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [adminUserIdFilter, setAdminUserIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [targetEntityTypeFilter, setTargetEntityTypeFilter] = useState('');
  const [targetEntityIdFilter, setTargetEntityIdFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(25);

  const fetchAuditLogs = useCallback(async (pageToFetch = 1) => {
    setLoading(true);
    const params = new URLSearchParams({
      page: pageToFetch.toString(),
      limit: limit.toString(),
    });
    if (adminUserIdFilter) params.set('adminUserId', adminUserIdFilter);
    if (actionFilter) params.set('action', actionFilter);
    if (targetEntityTypeFilter) params.set('targetEntityType', targetEntityTypeFilter);
    if (targetEntityIdFilter) params.set('targetEntityId', targetEntityIdFilter);
    if (startDateFilter) params.set('startDate', startDateFilter);
    if (endDateFilter) params.set('endDate', endDateFilter);

    try {
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setLogs(data.logs || []);
        setTotalPages(data.totalPages || 1);
        setCurrentPage(data.currentPage || 1);
      } else {
        toast.error(data.error || 'Failed to fetch audit logs');
        setLogs([]); setTotalPages(1); setCurrentPage(1);
      }
    } catch (err) {
      toast.error('Error fetching audit logs');
      console.error(err);
      setLogs([]); setTotalPages(1); setCurrentPage(1);
    }
    setLoading(false);
  }, [
    adminUserIdFilter, actionFilter, targetEntityTypeFilter, targetEntityIdFilter, 
    startDateFilter, endDateFilter, limit
  ]);

  useEffect(() => {
    if (status === 'authenticated' && (session?.user as any)?.role === 'admin') {
      fetchAuditLogs(currentPage);
    }
  }, [status, session, currentPage, fetchAuditLogs]);

  const handleFilterSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setCurrentPage(1); // Reset to first page when filters change
    fetchAuditLogs(1); // fetchAuditLogs is already a dependency of useEffect, but this ensures immediate fetch
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // useEffect will pick up currentPage change
    }
  };

  if (status === 'loading') return <p className="p-10">Loading session...</p>;
  const userRole = (session?.user as any)?.role;
  if (status !== 'authenticated' || userRole !== 'admin') {
    return <p className="p-10 text-red-600">Access denied. Admin privileges required.</p>;
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
                <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>Audit Logs</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <main className="flex-1 py-6">
        <div className="container px-4 md:px-6">
          <div className="grid gap-6">
            {/* Page Header */}
            <Card>
              <CardHeader>
                <CardTitle className="text-3xl flex items-center gap-3">
                  <Shield className="h-8 w-8" />
                  Audit Logs
                </CardTitle>
                <CardDescription>
                  Track administrative actions and system events
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{logs.length}</div>
                  <p className="text-xs text-muted-foreground">
                    Current page
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Admin Actions</CardTitle>
                  <User className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{logs.filter(l => l.action).length}</div>
                  <p className="text-xs text-muted-foreground">
                    Administrative actions
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Page {currentPage}</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalPages}</div>
                  <p className="text-xs text-muted-foreground">
                    Total pages
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Today's Logs</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {logs.filter(l => {
                      const logDate = new Date(l.timestamp).toDateString();
                      const today = new Date().toDateString();
                      return logDate === today;
                    }).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    From today
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Filter Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Filters
                </CardTitle>
                <CardDescription>Filter audit logs by various criteria</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Filter Inputs */}
                  <div>
                    <label htmlFor="adminUserId" className="block text-sm font-medium mb-1">Admin User ID</label>
                    <input type="text" id="adminUserId" value={adminUserIdFilter} onChange={e => setAdminUserIdFilter(e.target.value)} className="w-full border p-2 rounded-md" />
                  </div>
                  <div>
                    <label htmlFor="action" className="block text-sm font-medium mb-1">Action</label>
                    <input type="text" id="action" value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="w-full border p-2 rounded-md" />
                  </div>
                  <div>
                    <label htmlFor="targetEntityType" className="block text-sm font-medium mb-1">Target Entity Type</label>
                    <input type="text" id="targetEntityType" value={targetEntityTypeFilter} onChange={e => setTargetEntityTypeFilter(e.target.value)} className="w-full border p-2 rounded-md" />
                  </div>
                  <div>
                    <label htmlFor="targetEntityId" className="block text-sm font-medium mb-1">Target Entity ID</label>
                    <input type="text" id="targetEntityId" value={targetEntityIdFilter} onChange={e => setTargetEntityIdFilter(e.target.value)} className="w-full border p-2 rounded-md" />
                  </div>
                  <div>
                    <label htmlFor="startDate" className="block text-sm font-medium mb-1">Start Date</label>
                    <input type="date" id="startDate" value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} className="w-full border p-2 rounded-md" />
                  </div>
                  <div>
                    <label htmlFor="endDate" className="block text-sm font-medium mb-1">End Date</label>
                    <input type="date" id="endDate" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} className="w-full border p-2 rounded-md" />
                  </div>
                  <div className="md:col-span-2 lg:col-span-3 flex justify-end items-end">
                    <Button type="submit" className="bg-[#3366FF] hover:bg-[#2952cc]">
                      <Search className="h-4 w-4 mr-2" />
                      Apply Filters
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Audit Logs Table */}
            <Card>
              <CardHeader>
                <CardTitle>Audit Log Entries</CardTitle>
                <CardDescription>Detailed log of administrative actions and events</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#3366FF]"></div>
                    <p className="ml-2 text-muted-foreground">Loading audit logs...</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border text-sm table-auto">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-3 text-left font-medium">Timestamp</th>
                          <th className="p-3 text-left font-medium">Admin</th>
                          <th className="p-3 text-left font-medium">Action</th>
                          <th className="p-3 text-left font-medium">Target Type</th>
                          <th className="p-3 text-left font-medium">Target ID</th>
                          <th className="p-3 text-left font-medium">Reason</th>
                          <th className="p-3 text-left font-medium">Changes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logs.map((log) => (
                          <tr key={log._id?.toString()} className="border-t hover:bg-accent/5 transition-colors">
                            <td className="p-3 whitespace-nowrap font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                            <td className="p-3 truncate max-w-xs font-mono text-xs" title={log.adminUserId}>{log.adminUserId}</td>
                            <td className="p-3">
                              <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {log.action}
                              </span>
                            </td>
                            <td className="p-3">{log.targetEntityType}</td>
                            <td className="p-3 truncate max-w-xs font-mono text-xs" title={log.targetEntityId}>{log.targetEntityId}</td>
                            <td className="p-3 truncate max-w-md">{log.reason || '-'}</td>
                            <td className="p-3">
                              <pre className="bg-muted p-2 rounded text-xs max-w-md overflow-x-auto max-h-20 border">
                                {JSON.stringify(log.changes, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        ))}
                        {logs.length === 0 && (
                          <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No audit logs found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

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
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
} 