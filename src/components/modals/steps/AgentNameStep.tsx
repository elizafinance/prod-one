"use client";
import { useAgentSetupStore } from '@/stores/agentSetupStore';
import { useEffect, useState } from 'react';

export default function AgentNameStep() {
  const { name, setName } = useAgentSetupStore(); 
  const [localName, setLocalName] = useState(name);
  const [error, setError] = useState('');

  useEffect(() => {
    setLocalName(name); 
  }, [name]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setLocalName(newName);
    if (newName.trim().length > 24) {
      setError('Name cannot exceed 24 characters.');
    } else if (newName.trim().length === 0 && name.trim().length > 0) {
        setName('');
        setError('Agent name cannot be empty.');
    }
     else {
      setName(newName); 
      setError('');
    }
  };
  
  return (
    <div className="py-4">
      <label htmlFor="agentName" className="block text-sm font-medium text-slate-300 mb-1">
        Name your AI Counterpart:
      </label>
      <input
        type="text"
        id="agentName"
        value={localName}
        onChange={handleNameChange}
        placeholder="e.g., My Symbiote, AlphaSeeker"
        maxLength={26} 
        className="w-full px-3 py-2 rounded-md bg-slate-800 border border-slate-700 text-slate-100 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 placeholder-slate-500"
      />
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
      <p className="mt-2 text-xs text-slate-500">
        This name will represent your agent across the platform. Choose wisely, partner! (Max 24 chars)
      </p>
    </div>
  );
} 