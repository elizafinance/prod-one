"use client";

import { useState } from 'react';
import { toast } from 'sonner';
import { UserRow } from '@/app/admin/users/page';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserCreated: (user: UserRow) => void;
}

export default function CreateUserModal({ isOpen, onClose, onUserCreated }: CreateUserModalProps) {
  const [walletAddress, setWalletAddress] = useState('');
  const [xUsername, setXUsername] = useState('');
  const [email, setEmail] = useState('');
  const [points, setPoints] = useState<number | string>(0);
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setWalletAddress('');
    setXUsername('');
    setEmail('');
    setPoints(0);
    setRole('user');
  };

  const handleSave = async () => {
    if (!walletAddress.trim()) {
      toast.error('Wallet address is required');
      return;
    }
    const pts = parseInt(String(points), 10);
    if (isNaN(pts) || pts < 0) {
      toast.error('Points must be a non-negative number');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: walletAddress.trim(), xUsername: xUsername.trim() || undefined, email: email.trim() || undefined, points: pts, role }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('User created');
        onUserCreated(data.user);
        reset();
        onClose();
      } else {
        toast.error(data.error || 'Failed to create user');
      }
    } catch (err) {
      toast.error('Error creating user');
      console.error(err);
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Create New User</h2>
          <button onClick={() => { reset(); onClose(); }} className="text-2xl">&times;</button>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <label className="block font-medium">Wallet Address *</label>
            <input value={walletAddress} onChange={e=>setWalletAddress(e.target.value)} className="border rounded w-full p-2" placeholder="0x…" />
          </div>
          <div>
            <label className="block font-medium">X Username</label>
            <input value={xUsername} onChange={e=>setXUsername(e.target.value)} className="border rounded w-full p-2" placeholder="elonmusk" />
          </div>
          <div>
            <label className="block font-medium">Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} className="border rounded w-full p-2" placeholder="user@example.com" />
          </div>
          <div>
            <label className="block font-medium">Points</label>
            <input type="number" value={points} onChange={e=>setPoints(e.target.value)} className="border rounded w-full p-2" />
          </div>
          <div>
            <label className="block font-medium">Role</label>
            <select value={role} onChange={e=>setRole(e.target.value as 'user'|'admin')} className="border rounded w-full p-2 bg-white">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button onClick={handleSave} disabled={isSaving} className="mt-3 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400">
            {isSaving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
} 