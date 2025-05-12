'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import GlowingBadge from './GlowingBadge';

interface DonationBadgeFormProps {
  onBadgeEarned?: () => void;
}

const DonationBadgeForm: React.FC<DonationBadgeFormProps> = ({ onBadgeEarned }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [txSignature, setTxSignature] = useState('');
  const [showingManualVerify, setShowingManualVerify] = useState(false);
  const wallet = useWallet();
  
  const donationAmount = 0.1; // SOL
  const donationAmountLamports = donationAmount * LAMPORTS_PER_SOL;
  
  // Get donation address from environment variable
  const donationAddress = process.env.NEXT_PUBLIC_DONATION_WALLET_ADDRESS || '';
  
  const sendDonation = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      toast.error('Please connect your wallet first');
      return;
    }
    
    if (!donationAddress) {
      toast.error('Donation address not configured');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Create connection to Solana using Helius RPC URL
      const rpcUrl = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
      if (!rpcUrl) {
        toast.error('RPC URL is not configured. Please contact support.');
        setIsLoading(false);
        return;
      }
      const connection = new Connection(rpcUrl);
      
      // Create a new transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(donationAddress),
          lamports: donationAmountLamports,
        })
      );
      
      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = wallet.publicKey;
      
      // Sign the transaction
      const signedTransaction = await wallet.signTransaction(transaction);
      
      // Send the transaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize());
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, 'confirmed');
      
      // Set the transaction signature for verification
      setTxSignature(signature);
      toast.success('Donation sent successfully! Verifying...');
      
      // Automatically verify the transaction
      await verifyDonation(signature);
      
    } catch (error) {
      console.error('Error sending donation:', error);
      toast.error('Failed to send donation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const verifyDonation = async (signature: string) => {
    if (!signature.trim()) {
      toast.error('Please enter a transaction signature');
      return;
    }
    
    setVerifying(true);
    
    try {
      const response = await fetch('/api/badges/verify-donation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactionSignature: signature }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.alreadyEarned) {
          toast.info(data.message);
        } else {
          toast.success(data.message);
          if (onBadgeEarned) onBadgeEarned();
        }
      } else {
        toast.error(data.error || 'Failed to verify donation');
      }
    } catch (error) {
      console.error('Error verifying donation:', error);
      toast.error('Failed to verify donation. Please try again.');
    } finally {
      setVerifying(false);
    }
  };
  
  return (
    <div className="p-6 bg-white/5 rounded-lg shadow-lg">
      <h2 className="text-xl font-semibold text-purple-300 mb-4">Special Badge Opportunity</h2>
      
      <div className="mb-4 flex items-center gap-3">
        <GlowingBadge
          icon="✨"
          label="Generous Donor"
          color="bg-violet-600 text-white"
          glowColor="rgba(139, 92, 246, 0.7)"
          size="md"
        />
        <span className="text-gray-700">+250 Points</span>
      </div>
      
      <p className="text-black mb-6">
        Support DeFAI Rewards by donating {donationAmount} SOL and earn this exclusive glowing badge that will make you stand out on the leaderboard!
      </p>
      
      {donationAddress ? (
        <>
          <button
            onClick={sendDonation}
            disabled={isLoading || !wallet.connected}
            className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md shadow disabled:opacity-70 mb-3"
          >
            {isLoading ? 'Sending...' : `Donate ${donationAmount} SOL Now`}
          </button>
          
          {txSignature && (
            <div className="mt-4 p-3 bg-gray-800 rounded-md">
              <p className="text-gray-300 text-sm mb-2">Transaction sent! Signature:</p>
              <p className="text-xs text-gray-400 font-mono break-all">{txSignature}</p>
            </div>
          )}
          
          {!txSignature && (
            <div className="mt-2">
              <button
                onClick={() => setShowingManualVerify(!showingManualVerify)}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                {showingManualVerify ? 'Hide manual verification' : 'Already donated? Verify manually'}
              </button>
              
              {showingManualVerify && (
                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    value={txSignature}
                    onChange={(e) => setTxSignature(e.target.value)}
                    placeholder="Enter transaction signature"
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400"
                  />
                  <button
                    onClick={() => verifyDonation(txSignature)}
                    disabled={verifying || !txSignature.trim()}
                    className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow disabled:opacity-70"
                  >
                    {verifying ? 'Verifying...' : 'Verify Donation'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <p className="text-red-400 text-sm">Donation address not configured. Please try again later.</p>
      )}
    </div>
  );
};

export default DonationBadgeForm; 