'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import SquadTierManager from '@/components/admin/SquadTierManager';

interface SquadInfo {
  squadId: string;
  name: string;
  totalSquadPoints: number;
  tier: number;
  maxMembers: number;
  memberCount: number;
  leaderWalletAddress: string;
  createdAt: string;
}

export default function AdminSquadsPage() {
  const { data: session, status } = useSession();
  const [squads, setSquads] = useState<SquadInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSquad, setSelectedSquad] = useState<SquadInfo | null>(null);
  const [isUpdatingAllTiers, setIsUpdatingAllTiers] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<number | 'all'>('all');

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user?.role !== 'admin') {
      toast.error('Access denied - Admin only');
      return;
    }

    fetchSquads();
  }, [session, status]);

  const fetchSquads = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/squads');
      const data = await response.json();
      
      if (response.ok) {
        setSquads(data.squads || []);
      } else {
        toast.error(data.error || 'Failed to fetch squads');
      }
    } catch (error) {
      console.error('Error fetching squads:', error);
      toast.error('Error loading squads');
    }
    setLoading(false);
  };

  const handleBatchTierUpdate = async () => {
    setIsUpdatingAllTiers(true);
    try {
      const response = await fetch('/api/admin/squads/update-tiers', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast.success(`Updated ${data.totalUpdated} out of ${data.totalChecked} squads`);
        fetchSquads(); // Refresh the list
      } else {
        toast.error(data.error || 'Failed to update squad tiers');
      }
    } catch (error) {
      console.error('Error updating squad tiers:', error);
      toast.error('Error updating squad tiers');
    }
    setIsUpdatingAllTiers(false);
  };

  const filteredSquads = squads.filter(squad => {
    const matchesSearch = squad.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         squad.squadId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         squad.leaderWalletAddress.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTier = filterTier === 'all' || squad.tier === filterTier;
    
    return matchesSearch && matchesTier;
  });

  if (status === 'loading') {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (!session || session.user?.role !== 'admin') {
    return <div className="flex justify-center items-center min-h-screen">Access Denied</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Squad Management</h1>
        
        <button
          onClick={handleBatchTierUpdate}
          disabled={isUpdatingAllTiers}
          className="bg-primary hover:bg-primary/80 text-primary-foreground px-4 py-2 rounded-md disabled:opacity-50"
        >
          {isUpdatingAllTiers ? 'Updating...' : 'Update All Squad Tiers'}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4">
        <input
          type="text"
          placeholder="Search squads..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 p-2 border border-input rounded-md bg-background"
        />
        
        <select
          value={filterTier}
          onChange={(e) => setFilterTier(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="p-2 border border-input rounded-md bg-background"
        >
          <option value="all">All Tiers</option>
          <option value={0}>No Tier</option>
          <option value={1}>Tier 1</option>
          <option value={2}>Tier 2</option>
          <option value={3}>Tier 3</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center">Loading squads...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSquads.map((squad) => (
            <div key={squad.squadId} className="bg-card border border-border rounded-lg p-4">
              <div className="mb-4">
                <h3 className="font-semibold text-lg">{squad.name}</h3>
                <p className="text-sm text-muted-foreground">ID: {squad.squadId}</p>
                <p className="text-sm text-muted-foreground">
                  Leader: {squad.leaderWalletAddress.substring(0, 8)}...
                </p>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between">
                  <span className="text-sm">Points:</span>
                  <span className="font-semibold">{squad.totalSquadPoints.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Members:</span>
                  <span>{squad.memberCount} / {squad.maxMembers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Current Tier:</span>
                  <span className="font-semibold">
                    {squad.tier === 0 ? 'No Tier' : `Tier ${squad.tier}`}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedSquad(squad)}
                className="w-full py-2 px-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md text-sm"
              >
                Manage Tier
              </button>
            </div>
          ))}
        </div>
      )}

      {filteredSquads.length === 0 && !loading && (
        <div className="text-center py-12 text-muted-foreground">
          No squads found matching your criteria.
        </div>
      )}

      {/* Squad Tier Management Modal */}
      {selectedSquad && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Manage: {selectedSquad.name}</h2>
              <button
                onClick={() => setSelectedSquad(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-3 bg-muted rounded-md">
              <p className="text-sm"><strong>Points:</strong> {selectedSquad.totalSquadPoints.toLocaleString()}</p>
              <p className="text-sm"><strong>Members:</strong> {selectedSquad.memberCount} / {selectedSquad.maxMembers}</p>
              <p className="text-sm"><strong>Leader:</strong> {selectedSquad.leaderWalletAddress.substring(0, 12)}...</p>
            </div>

            <SquadTierManager
              squadId={selectedSquad.squadId}
              currentTier={selectedSquad.tier}
              squadName={selectedSquad.name}
              onUpdate={() => {
                fetchSquads();
                setSelectedSquad(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}