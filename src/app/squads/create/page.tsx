"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react'; // To ensure user has a wallet connected
import { toast } from 'sonner';
import Link from 'next/link';

export default function CreateSquadPage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  
  const [squadName, setSquadName] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState<number | null>(null);
  const [pointsLoading, setPointsLoading] = useState(true);
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [tierRequirements, setTierRequirements] = useState<{ 
    tiers: Array<{ tier: number, minPoints: number, maxMembers: number }>,
    minRequiredPoints: number 
  } | null>(null);
  const [isFetchingTiers, setIsFetchingTiers] = useState(true);

  // Fetch tier requirements from the server
  useEffect(() => {
    async function fetchTierRequirements() {
      setIsFetchingTiers(true);
      try {
        const res = await fetch('/api/squads/tier-requirements');
        const data = await res.json();
        if (res.ok) {
          setTierRequirements(data);
        }
      } catch (err) {
        console.error("Failed to fetch tier requirements:", err);
      }
      setIsFetchingTiers(false);
    }
    
    fetchTierRequirements();
  }, []);

  useEffect(() => {
    async function fetchPoints() {
      setPointsLoading(true);
      setPointsError(null);
      if (connected && publicKey) {
        try {
          const res = await fetch(`/api/users/points?address=${publicKey.toBase58()}`);
          const data = await res.json();
          if (res.ok && typeof data.points === 'number') {
            setUserPoints(data.points);
            setPointsLoading(false);
            return;
          } else {
            setPointsError(data.error || 'Could not fetch points from server.');
          }
        } catch (err) {
          setPointsError('Could not fetch points from server.');
        }
      }
      // Fallback to localStorage
      try {
        const stored = localStorage.getItem('defaiUserData');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (typeof parsed.points === 'number') {
            setUserPoints(parsed.points);
            setPointsLoading(false);
            return;
          }
        }
      } catch {}
      setPointsLoading(false);
      setPointsError('Could not determine your points. Please visit the Dashboard.');
    }
    fetchPoints();
  }, [connected, publicKey]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!connected || !publicKey) {
      toast.error('Please connect your wallet to create a squad.');
      setIsLoading(false);
      return;
    }

    if (!squadName.trim()) {
      toast.error('Squad name is required.');
      setIsLoading(false);
      return;
    }

    try {
      // The backend /api/squads/create now uses session for leaderWalletAddress
      const response = await fetch('/api/squads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ squadName, description }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Squad created successfully!');
        router.push('/'); 
      } else {
        setError(data.error || 'Failed to create squad.');
        toast.error(data.error || 'Failed to create squad.');
      }
    } catch (err) {
      console.error("Create squad error:", err);
      setError('An unexpected error occurred.');
      toast.error('An unexpected error occurred while creating the squad.');
    }
    setIsLoading(false);
  };

  const canCreate = !pointsLoading && userPoints !== null && 
    tierRequirements !== null && userPoints >= tierRequirements.minRequiredPoints;

  return (
    <main className="flex flex-col items-center min-h-screen p-4 sm:p-8 bg-white text-gray-900">
      <div className="w-full max-w-md mx-auto my-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold font-spacegrotesk tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-green-500 via-teal-600 to-blue-600">
            Forge Your Squad
          </h1>
          <p className="text-gray-600 mt-2">Lead your team to victory and earn rewards together!</p>
        </div>

        {pointsLoading && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded text-blue-700 text-center flex flex-col items-center">
            <svg className="animate-spin h-6 w-6 mb-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Checking eligibility...
          </div>
        )}

        {!pointsLoading && !canCreate && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center my-4">
            <p className="text-red-700">
              You need at least <b>{tierRequirements?.minRequiredPoints?.toLocaleString() || '1,000'} DeFAI Points</b> to create a squad.<br />
              <br />
              <b className="text-red-800">Squad Tiers:</b><br />
              {tierRequirements?.tiers.map(tier => (
                <span key={tier.tier} className="text-sm text-gray-600">
                  {tier.minPoints.toLocaleString()} Points: Up to {tier.maxMembers} members<br />
                </span>
              )) || (
                <span className="text-sm text-gray-600">
                  1,000 Points: Up to 10 members<br />
                  5,000 Points: Up to 50 members<br />
                  10,000 Points: Up to 100 members<br />
                </span>
              )}
              <br />
              <span className="text-orange-600 font-medium">Your current points: {userPoints !== null ? userPoints.toLocaleString() : 'Loading...'}</span>
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 shadow-xl rounded-xl p-6 sm:p-8 space-y-6">
          <div>
            <label htmlFor="squadName" className="block text-sm font-medium text-gray-700 mb-1">
              Squad Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              id="squadName"
              value={squadName}
              onChange={(e) => setSquadName(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-gray-900 placeholder-gray-400 disabled:bg-gray-200"
              placeholder="The Legends"
              maxLength={30}
              required
              disabled={!canCreate || pointsLoading}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description (Optional)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full p-3 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-gray-900 placeholder-gray-400 disabled:bg-gray-200"
              placeholder="A brief description of your squad's mission..."
              maxLength={150}
              disabled={!canCreate || pointsLoading}
            />
          </div>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <button
            type="submit"
            disabled={isLoading || !connected || !canCreate || pointsLoading}
            className="w-full py-3 px-5 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Squad...
              </span>
            ) : pointsLoading ? 'Checking...' : 'Create Squad'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <Link href="/" passHref>
            <span className="text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer">
              Back to Dashboard
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
} 