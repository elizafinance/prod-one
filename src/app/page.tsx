"use client";

import { useState } from 'react';
import SiteLogo from "@/assets/logos/favicon.ico"; // Using favicon as the main small logo
import Illustration from "@/assets/images/tits.png"; // The illustration
import Link from 'next/link'; // Already imported, but confirming it's here

// REMOVED slide image imports and images array
// REMOVED Link import as social buttons are removed

export default function HomePage() {
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<string | number | null>(null);
  // REMOVED currentImageIndex state
  // REMOVED copied state and handleCopySnapshotText function
  const [isLoading, setIsLoading] = useState(false);

  // REMOVED useEffect for cycling background images
  // REMOVED snapshotText and handleCopySnapshotText

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
        setResult(data.error || "Sorry You Don't Qualify For The Airdrop."); // Ensured fallback message
      }
    } catch (error) {
      console.error("Failed to fetch airdrop data:", error);
      setResult("Failed to check airdrop status. Please try again.");
    }
    setIsLoading(false);
  };

  return (
    <main className="flex flex-col items-center justify-start min-h-screen p-4 sm:p-8 bg-white text-gray-900 pt-12 sm:pt-20">
      {/* Logo at the top */}
      <img 
        className="h-12 sm:h-16 mb-8" // Adjusted size and margin
        src={SiteLogo.src} 
        alt="DeFAI Rewards Logo" 
        // No filter needed for favicon on white background
      />

      {/* Main Headings */}
      <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-black text-center">
        Banking AI Agents
      </h1>
      <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-black text-center mb-10">
        Rewarding Humans
      </h2>

      {/* Welcome Copy */}
      <p className="text-center mb-8 text-gray-700 text-base sm:text-sm max-w-xl">
        Welcome to the DeFAIRewards $AIRdrop checker. Simply paste your wallet address in the box and click check AIRdrop to see what you will receive via Streamflow when we launch! Numbers are based on the the DeFAI Snapshot taken March 31, 2025 and will be updated with the May 20, 2025 snapshot as we get closer to launch.
      </p>

      {/* Input and Button Area */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mb-4 w-full max-w-lg">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter your wallet address"
          className="flex-grow w-full sm:w-auto p-3 bg-white border border-gray-400 rounded-md focus:ring-2 focus:ring-[#86CEEA] focus:border-[#86CEEA] outline-none text-gray-900 placeholder-gray-500"
          disabled={isLoading}
        />
        <button
          onClick={handleCheckAirdrop}
          className="w-full sm:w-auto text-black font-semibold py-3 px-6 rounded-md transition duration-150 ease-in-out hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          style={{ backgroundColor: '#86CEEA' }} 
          disabled={isLoading}
        >
          {isLoading ? 'Checking...' : 'Check'}
        </button>
      </div>

      {/* Result Display */}
      {result !== null && !isLoading && (
        <div className="mt-4 mb-4 p-4 bg-gray-100 rounded-md text-center w-full max-w-lg">
          {typeof result === 'number' ? (
            <p className="text-lg text-gray-800">
              🎉 Congratulations! You will receive: <span className="font-bold text-xl text-green-600">{result.toLocaleString()}</span> $AIR tokens.
            </p>
          ) : (
            <p className="text-lg text-red-600">{result}</p>
          )}
        </div>
      )}
      
      {/* Conditional Buttons - Home, Chart, X, Telegram - shown after check */}
      {result !== null && !isLoading && (
        <div className="mt-4 mb-8 flex flex-wrap justify-center gap-3 sm:gap-4 w-full max-w-lg"> {/* Changed to flex-wrap and adjusted gap */}
          <Link href="https://defairewards.net" target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <button 
              className="w-full sm:w-auto text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out hover:opacity-90 whitespace-nowrap" /* Adjusted padding */
              style={{ backgroundColor: '#86CEEA' }}
            >
              Home
            </button>
          </Link>
          <Link href="https://dexscreener.com/solana/3jiwexdwzxjva2yd8aherfsrn7a97qbwmdz8i4q6mh7y" target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <button 
              className="w-full sm:w-auto text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out hover:opacity-90 whitespace-nowrap" /* Adjusted padding */
              style={{ backgroundColor: '#86CEEA' }}
            >
              Chart
            </button>
          </Link>
          <Link href="https://x.com/defairewards" target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <button 
              className="w-full sm:w-auto text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out hover:opacity-90 whitespace-nowrap" /* Adjusted padding */
              style={{ backgroundColor: '#86CEEA' }}
            >
              Follow on X
            </button>
          </Link>
          <Link href="https://t.me/defairewards" target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
            <button 
              className="w-full sm:w-auto text-white font-bold py-2 px-4 rounded-md transition duration-150 ease-in-out hover:opacity-90 whitespace-nowrap" /* Adjusted padding */
              style={{ backgroundColor: '#86CEEA' }}
            >
              Join Telegram
            </button>
          </Link>
        </div>
      )}

      {/* Illustration at the bottom */}
      <div className="mt-auto w-full flex justify-center pt-8"> {/* Pushes to bottom if content is short, adds padding top */}
        <img 
            src={Illustration.src} 
            alt="Illustration" 
            className="max-w-full h-auto md:max-w-md lg:max-w-lg" // Responsive sizing for illustration
        />
      </div>

      {/* REMOVED Social media buttons and snapshot text */}

    </main>
  );
}
