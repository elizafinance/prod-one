"use client";

import { useState, useEffect } from 'react';
// import NewLogo from "@/assets/logos/logo.png"; // Old logo import
import Favicon from "@/assets/logos/favicon.ico"; // Import the favicon
import Link from 'next/link';

// REMOVED slide image imports
// REMOVED images array

export default function HomePage() {
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<string | number | null>(null);
  // REMOVED currentImageIndex state
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // REMOVED useEffect for cycling background images

  const snapshotText = "Numbers are based on the initial March 31, 2025 snapshot of 1:10. We will update the numbers with the 1:1 as we get closer to launch.";

  const handleCopySnapshotText = () => {
    navigator.clipboard.writeText(snapshotText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const handleCheckAirdrop = async () => {
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      setResult("Please enter a wallet address.");
      return;
    }
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch(`/api/check-airdrop?address=${encodeURIComponent(trimmedAddress)}`);
      const data = await response.json();

      if (response.ok) {
        setResult(data.AIRDROP);
      } else {
        setResult(data.error || "An error occurred.");
      }
    } catch (error) {
      console.error("Failed to fetch airdrop data:", error);
      setResult("Failed to check airdrop status. Please try again.");
    }
    setIsLoading(false);
  };

  return (
    <main 
      className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 bg-white text-gray-900"
    >
      <div 
        className="p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md flex flex-col items-center" 
        style={{ backgroundColor: '#2D6A7D' }}
      >
        <img 
          className="h-24 mb-6"
          src={Favicon.src} 
          alt="DeFAIRewards Favicon"
        />
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-purple-400">$AIRdrop Eligibility</h1>
        
        <p className="text-center mb-4 text-gray-100 text-sm sm:text-base">
          Welcome to the DeFAIRewards $AIRdrop checker. Simply paste your wallet address in the box and click check AIRdrop to see what you will receive via Streamflow when we launch!
        </p>

        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter your wallet address"
          className="w-full p-3 mb-4 bg-gray-700 bg-opacity-50 border border-gray-500 rounded-md focus:ring-purple-400 focus:border-purple-400 outline-none text-white placeholder-gray-300"
          disabled={isLoading}
        />
        <button
          onClick={handleCheckAirdrop}
          className="w-full bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-md transition duration-150 ease-in-out mb-4 disabled:opacity-50"
          disabled={isLoading}
        >
          {isLoading ? 'Checking...' : 'Check Airdrop'}
        </button>
        {result !== null && !isLoading && (
          <div className="mt-2 p-4 bg-gray-700 bg-opacity-70 rounded-md text-center w-full">
            {typeof result === 'number' ? (
              <p className="text-lg text-gray-50">
                🎉 Congratulations! You will receive: <span className="font-bold text-xl text-green-300">{result.toLocaleString()}</span> $AIR tokens.
              </p>
            ) : (
              <p className="text-lg text-red-300">{result}</p>
            )}
          </div>
        )}

        <div className="mt-6 text-center w-full">
          <p 
            className="text-xs text-gray-300 hover:text-purple-300 cursor-pointer"
            onClick={handleCopySnapshotText}
            title="Copy snapshot info"
          >
            {snapshotText}
          </p>
          {copied && <span className="text-xs text-green-300 ml-2">Copied!</span>}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4 w-full">
          <Link href="https://x.com/defairewards" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <button 
              className="w-full sm:w-auto text-white font-bold py-2 px-6 rounded-md transition duration-150 ease-in-out hover:opacity-90"
              style={{ backgroundColor: '#86CEEA' }}
            >
              Follow on X
            </button>
          </Link>
          <Link href="https://t.me/defairewards" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <button 
              className="w-full sm:w-auto text-white font-bold py-2 px-6 rounded-md transition duration-150 ease-in-out hover:opacity-90"
              style={{ backgroundColor: '#86CEEA' }}
            >
              Join Telegram
            </button>
          </Link>
        </div>

      </div>
    </main>
  );
}
