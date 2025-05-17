"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
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
    <main className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Admin Audit Logs</h1>

      <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg bg-gray-50">
        {/* Filter Inputs */}
        <div>
          <label htmlFor="adminUserId" className="block text-sm font-medium">Admin User ID</label>
          <input type="text" id="adminUserId" value={adminUserIdFilter} onChange={e => setAdminUserIdFilter(e.target.value)} className="mt-1 border p-2 rounded w-full" />
        </div>
        <div>
          <label htmlFor="action" className="block text-sm font-medium">Action</label>
          <input type="text" id="action" value={actionFilter} onChange={e => setActionFilter(e.target.value)} className="mt-1 border p-2 rounded w-full" />
        </div>
        <div>
          <label htmlFor="targetEntityType" className="block text-sm font-medium">Target Entity Type</label>
          <input type="text" id="targetEntityType" value={targetEntityTypeFilter} onChange={e => setTargetEntityTypeFilter(e.target.value)} className="mt-1 border p-2 rounded w-full" />
        </div>
        <div>
          <label htmlFor="targetEntityId" className="block text-sm font-medium">Target Entity ID</label>
          <input type="text" id="targetEntityId" value={targetEntityIdFilter} onChange={e => setTargetEntityIdFilter(e.target.value)} className="mt-1 border p-2 rounded w-full" />
        </div>
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium">Start Date</label>
          <input type="date" id="startDate" value={startDateFilter} onChange={e => setStartDateFilter(e.target.value)} className="mt-1 border p-2 rounded w-full" />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium">End Date</label>
          <input type="date" id="endDate" value={endDateFilter} onChange={e => setEndDateFilter(e.target.value)} className="mt-1 border p-2 rounded w-full" />
        </div>
        <div className="md:col-span-2 lg:col-span-3 flex justify-end items-end">
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Apply Filters</button>
        </div>
      </form>

      {loading ? (
        <p className="text-center py-10">Loading audit logs...</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border text-sm table-auto">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 text-left">Timestamp</th>
                  <th className="p-2 text-left">Admin</th>
                  <th className="p-2 text-left">Action</th>
                  <th className="p-2 text-left">Target Type</th>
                  <th className="p-2 text-left">Target ID</th>
                  <th className="p-2 text-left">Reason</th>
                  <th className="p-2 text-left">Changes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id?.toString()} className="border-t hover:bg-gray-50">
                    <td className="p-2 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-2 truncate max-w-xs" title={log.adminUserId}>{log.adminUserId}</td>
                    <td className="p-2">{log.action}</td>
                    <td className="p-2">{log.targetEntityType}</td>
                    <td className="p-2 truncate max-w-xs" title={log.targetEntityId}>{log.targetEntityId}</td>
                    <td className="p-2 truncate max-w-md">{log.reason || '-'}</td>
                    <td className="p-2">
                        <pre className="bg-gray-200 p-1 rounded text-xs max-w-md overflow-x-auto max-h-20">
                            {JSON.stringify(log.changes, null, 2)}
                        </pre>
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={7} className="text-center p-4 text-gray-500">No audit logs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center space-x-2">
              <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="px-3 py-1 border rounded text-xs disabled:opacity-50">First</button>
              <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="px-3 py-1 border rounded text-xs disabled:opacity-50">Prev</button>
              <span className="text-xs">Page {currentPage} of {totalPages}</span>
              <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 py-1 border rounded text-xs disabled:opacity-50">Next</button>
              <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="px-3 py-1 border rounded text-xs disabled:opacity-50">Last</button>
            </div>
          )}
        </>
      )}
    </main>
  );
} 