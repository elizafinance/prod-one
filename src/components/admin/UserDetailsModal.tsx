"use client";

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { FullUserDetail, ActionLogEntry, NotificationLogEntry } from '@/app/admin/users/page'; // Import interfaces

interface UserDetailsModalProps {
  user: FullUserDetail;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdate?: (updatedUser: FullUserDetail) => void; // Add the onUserUpdate prop
}

export default function UserDetailsModal({ user, isOpen, onClose, onUserUpdate }: UserDetailsModalProps) { // Destructure onUserUpdate
  const [activeTab, setActiveTab] = useState('details');
  const [newPoints, setNewPoints] = useState<number | string>(user.points || 0);
  const [newRole, setNewRole] = useState<string>(user.role || 'user');
  const [newWalletAddress, setNewWalletAddress] = useState<string>(user.walletAddress || '');
  const [reason, setReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNewPoints(user.points || 0);
    setNewRole(user.role || 'user');
    setNewWalletAddress(user.walletAddress || '');
    setReason('');
    setActiveTab('details');
  }, [user]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    const payload: any = {};
    let changesMade = false;

    const currentPoints = user.points || 0;
    const currentRole = user.role || 'user';
    const currentWalletAddress = user.walletAddress || '';

    if (String(newPoints) !== String(currentPoints)) {
        const parsedPoints = parseInt(String(newPoints), 10);
        if (isNaN(parsedPoints) || parsedPoints < 0) {
            toast.error('Invalid points value. Must be a non-negative number.');
            setIsSaving(false);
            return;
        }
        if (!reason.trim()) {
            toast.error('Reason is required when changing points.');
            setIsSaving(false);
            return;
        }
        payload.points = parsedPoints;
        payload.reason = reason; // reason is shared for all changes in this modal for now
        changesMade = true;
    }

    if (newRole !== currentRole) {
        payload.role = newRole;
        if (!reason.trim() && !changesMade) { // Require reason if it's the only change
            toast.error('Reason is required when changing role.');
            setIsSaving(false);
            return;
        }
        if (!payload.reason) payload.reason = reason; // Use reason if provided
        changesMade = true;
    }

    if (newWalletAddress !== currentWalletAddress) {
        if (newWalletAddress && !/^0x[a-fA-F0-9]{40}$/.test(newWalletAddress) && !/^[T][a-zA-Z0-9]{33}$/.test(newWalletAddress)) {
             // Basic check for ETH/TRX like addresses, can be expanded
            // toast.warn('Wallet address format might be incorrect. Proceeding anyway.');
            // For now, let's allow any string, backend does more validation if needed.
        }
        payload.walletAddress = newWalletAddress; // API handles if it's empty string for unlinking
        if (!reason.trim() && !changesMade) { // Require reason if it's the only change
            toast.error('Reason is required when changing wallet address.');
            setIsSaving(false);
            return;
        }
        if (!payload.reason) payload.reason = reason; // Use reason if provided
        changesMade = true;
    }

    if (!changesMade) {
        toast.info('No changes to save.');
        setIsSaving(false);
        return;
    }
    
    // Ensure reason is in payload if any change was made and reason was entered
    if (changesMade && reason.trim() && !payload.reason) {
        payload.reason = reason.trim();
    }
    if (changesMade && !payload.reason && (payload.points !== undefined || payload.role !== undefined || payload.walletAddress !== undefined)) {
        // Check if any of the main fields that *require* a reason were changed
        if ((payload.points !== undefined && String(newPoints) !== String(currentPoints)) || 
            (payload.role !== undefined && newRole !== currentRole) || 
            (payload.walletAddress !== undefined && newWalletAddress !== currentWalletAddress)){
            toast.error('A reason is required for the changes made.');
            setIsSaving(false);
            return;
        }
    }

    try {
      // Determine API endpoint: if user has walletAddress, use that, otherwise use _id.
      // The PATCH to /api/admin/users/id/[id] can handle walletAddress updates.
      const apiEndpoint = user._id ? `/api/admin/users/id/${user._id.toString()}` : `/api/admin/users/${user.walletAddress}`;
      if (!user._id && !user.walletAddress) {
        toast.error("User has no identifier (ID or Wallet Address) to update.");
        setIsSaving(false);
        return;
      }

      const res = await fetch(apiEndpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'User updated successfully');
        if (data.user && onUserUpdate) { // Check if onUserUpdate is provided
          onUserUpdate(data.user as FullUserDetail); // Call it with the updated user data from API response
        }
        onClose(); // Close modal (parent might still refetch if onUserUpdate doesn't fully cover its needs)
      } else {
        toast.error(data.error || 'Failed to update user');
      }
    } catch (err) {
      toast.error('Error updating user');
      console.error(err);
    }
    setIsSaving(false);
  };
  
  const renderDetailsTab = () => (
    <div className="space-y-3">
        {user._id && (
             <div key="db_id"><strong>Database ID: </strong> <span className="font-mono">{user._id.toString()}</span></div>
        )}
        {Object.entries(user || {}).map(([key, value]) => {
            if (['recentActions', 'recentNotifications', '_id'].includes(key) || (typeof value === 'object' && value !== null) || Array.isArray(value)) {
                return null; 
            }
            if (typeof value === 'function') return null;
            // Skip walletAddress here as it has its own input field now
            if (key === 'walletAddress') return null;

            return (
                <div key={key}>
                    <strong className="capitalize">{key.replace(/([A-Z])/g, ' $1')}: </strong> 
                    <span>{String(value === null || value === undefined ? 'N/A' : value)}</span>
                </div>
            );
        })}
        
        <div className="mt-4 pt-4 border-t">
            <h4 className="font-semibold mb-2">Update User</h4>
            <div className="mb-3">
                <label className="block text-sm font-medium">Wallet Address:</label>
                <input type="text" value={newWalletAddress} onChange={e => setNewWalletAddress(e.target.value)} placeholder="Enter wallet address (or leave empty to unlink)" className="border p-1 rounded w-full font-mono" />
            </div>
            <div className="mb-3">
                <label className="block text-sm font-medium">Points:</label>
                <input type="number" value={newPoints} onChange={e => setNewPoints(e.target.value)} className="border p-1 rounded w-full" />
            </div>
            <div className="mb-3">
                <label className="block text-sm font-medium">Role:</label>
                <select value={newRole} onChange={e => setNewRole(e.target.value)} className="border p-1 rounded w-full">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select>
            </div>
            <div className="mb-3">
                <label className="block text-sm font-medium">Reason (Required for any change):</label>
                <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="State the reason for this update" className="border p-1 rounded w-full" rows={2}></textarea>
            </div>
            <button onClick={handleSave} disabled={isSaving} className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:bg-gray-400">
                {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
    </div>
  );

  const renderActivityTab = (items: ActionLogEntry[] | NotificationLogEntry[] | undefined, type: 'action' | 'notification') => {
    if (!items || items.length === 0) return <p>No {type} history.</p>;
    return (
        <ul className="space-y-2 text-xs">
            {items.map((item: any) => (
                <li key={item._id} className="p-2 border rounded bg-gray-50">
                    {type === 'action' && <div><strong>Type:</strong> {item.actionType} {item.pointsAwarded ? `(${item.pointsAwarded} pts)`: ''}</div>}
                    {type === 'notification' && <div><strong>Title:</strong> {item.title}</div>}
                    {type === 'notification' && <p><strong>Msg:</strong> {item.message}</p>}
                    <div><strong>Date:</strong> {new Date(item.timestamp || item.createdAt).toLocaleString()}</div>
                    {item.notes && <div><strong>Notes:</strong> {item.notes}</div>}
                </li>
            ))}
        </ul>
    );
  }

  const renderRawDataTab = () => {
    // The `user` prop is the FullUserDetail object itself, which contains all user document fields 
    // directly, plus recentActions and recentNotifications as top-level keys.
    return (
      <div className="space-y-3">
        <h4 className="font-semibold mb-2">Raw User Data (includes related logs)</h4>
        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
          {JSON.stringify(user, null, 2)} 
        </pre>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-5 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">User Details: {(user.xUsername || user.walletAddress || user._id?.toString() || 'Unknown User').substring(0,15)}...</h2>
          <button onClick={onClose} className="text-2xl">&times;</button>
        </div>

        <div className="border-b mb-4">
          <nav className="flex space-x-1 sm:space-x-2 text-sm sm:text-base overflow-x-auto whitespace-nowrap">
            <button onClick={() => setActiveTab('details')} className={`py-2 px-3 ${activeTab === 'details' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>Details & Edit</button>
            <button onClick={() => setActiveTab('actions')} className={`py-2 px-3 ${activeTab === 'actions' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>Actions</button>
            <button onClick={() => setActiveTab('notifications')} className={`py-2 px-3 ${activeTab === 'notifications' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>Notifications</button>
            <button onClick={() => setActiveTab('rawdata')} className={`py-2 px-3 ${activeTab === 'rawdata' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-blue-500'}`}>Raw Data</button>
          </nav>
        </div>

        <div className="overflow-y-auto flex-grow">
          {activeTab === 'details' && renderDetailsTab()}
          {activeTab === 'actions' && renderActivityTab(user.recentActions, 'action')}
          {activeTab === 'notifications' && renderActivityTab(user.recentNotifications, 'notification')}
          {activeTab === 'rawdata' && renderRawDataTab()}
        </div>
      </div>
    </div>
  );
} 