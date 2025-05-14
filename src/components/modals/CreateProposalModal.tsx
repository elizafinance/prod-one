'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Assuming you have an Input component
// import { Textarea } from "@/components/ui/textarea"; // Textarea component not found
import { toast } from 'sonner';

interface CreateProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  squadId: string | null; // The ID of the squad creating the proposal
  onProposalCreated: () => void; // Callback after successful creation
}

const CreateProposalModal: React.FC<CreateProposalModalProps> = ({ isOpen, onClose, squadId, onProposalCreated }) => {
  const [tokenContractAddress, setTokenContractAddress] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!squadId) {
      toast.error('Squad ID is missing. Cannot create proposal.');
      return;
    }
    if (!tokenContractAddress.trim() || !tokenName.trim() || !reason.trim()) {
      toast.error('All fields are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/squads/${squadId}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenContractAddress, tokenName, reason }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create proposal.');
      }

      toast.success('Proposal created successfully!');
      onProposalCreated(); // Trigger callback (e.g., to refresh data or navigate)
      onClose(); // Close the modal
      // Reset form fields
      setTokenContractAddress('');
      setTokenName('');
      setReason('');
    } catch (err: any) {
      toast.error(err.message || 'An error occurred while creating the proposal.');
    }
    setIsSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-white border-gray-300 shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-spacegrotesk text-blue-700">
            Create New Token Proposal
          </DialogTitle>
          <DialogDescription className="text-gray-600 pt-2">
            Propose a new token for the AI Reward. Ensure all details are accurate.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="py-4 space-y-4">
          <div>
            <label htmlFor="tokenContractAddress" className="block text-sm font-medium text-gray-700 mb-1">Token Contract Address (Solana)</label>
            <Input 
              id="tokenContractAddress" 
              value={tokenContractAddress} 
              onChange={(e) => setTokenContractAddress(e.target.value)} 
              placeholder="Enter Solana token mint address" 
              required 
              className="w-full text-gray-900"
            />
          </div>
          <div>
            <label htmlFor="tokenName" className="block text-sm font-medium text-gray-700 mb-1">Token Name/Symbol</label>
            <Input 
              id="tokenName" 
              value={tokenName} 
              onChange={(e) => setTokenName(e.target.value)} 
              placeholder="e.g., MyToken (MYT)" 
              maxLength={50}
              required 
              className="w-full text-gray-900"
            />
          </div>
          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">Reason for Nomination (max 140 chars)</label>
            <textarea 
              id="reason" 
              value={reason} 
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)} 
              placeholder="Briefly explain why this token should be chosen..." 
              maxLength={140}
              rows={3}
              required 
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{reason.length}/140</p>
          </div>
          
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSubmitting ? 'Submitting...' : 'Submit Proposal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProposalModal; 