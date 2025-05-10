"use client";

import { useState, useEffect } from 'react';

// Import slide images
import slide1 from '@/assets/images/slide1_new.png';
import slide3 from '@/assets/images/slide_3.png';
import slide6 from '@/assets/images/slide_6.png';
import slide7 from '@/assets/images/slide_7.png';
import slide8 from '@/assets/images/slide_8.png';
import slide9 from '@/assets/images/slide_9.png';
import slide11 from '@/assets/images/slide_11.png';
import NewLogo from "@/assets/logos/logo.png"; // Import the logo
// Note: Header was imported but not used. Keeping it out for now unless needed.

// Processed Airdrop Data from 10_1AIR - Sheet1.csv
const airdropData = [
  { "Account": "GypeM9BqKeKGJGTnPxTf1PdVa3UC2LkiYnvvW8CJSNj2", "Token Account": "5CQuapmsq7bUuL64HfMigafHAsR9uynUjnktSXLmNJFY", "Quantity": 50000000, "AIRDROP": 500000000 },
  { "Account": "ABHVsoEg22fo69mxu12VAEseVdpfRR9uW9jyVoZ9v1di", "Token Account": "GbJxuFjYBq7R677dPGD2LeB4RHV995sHHmuBP3oxZ7w9", "Quantity": 415891747.5, "AIRDROP": 4158917475 },
  { "Account": "A7YWD2fHaeGKQhshWyWW7pwyb6f7L6PMg5ZgVF4N9fLY", "Token Account": "5PBLnAdqnSQCtKVk8dQnrrMRS9PyAX7zhKtrvGRzssud", "Quantity": 50000000, "AIRDROP": 500000000 },
  { "Account": "3jhmLJ5VgkeYAmzxzzzTND66PZrKL2RScHYr2StgkwBh", "Token Account": "HedzNftu9r9rhqGqSYZj9Qisrt7UbQ81GKfb3SWzmnve", "Quantity": 40980258.75, "AIRDROP": 409802587.5 },
  { "Account": "JQCdzkb9w6DEhG1jPqf1AVDLdGwRmyugMnxNxzBgNVk", "Token Account": "DKSFYBz4imWhYiWnXXKrmJNkmYrkPK9wkKFinYrrX8VS", "Quantity": 24151429.18, "AIRDROP": 241514291.8 },
  // ... (Full airdropData array will be here)
];

const images = [
  slide1,
  slide3,
  slide6,
  slide7,
  slide8,
  slide9,
  slide11,
];

export default function HomePage() {
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<string | number | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [copied, setCopied] = useState(false); // State for copy confirmation

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, []);

  const handleCheckAirdrop = () => {
    const trimmedAddress = address.trim();
    if (!trimmedAddress) {
      setResult("Please enter a wallet address.");
      return;
    }

    // Efficiently find the entry
    const entry = airdropData.find(item => item.Account === trimmedAddress);

    if (entry) {
      setResult(entry.AIRDROP);
    } else {
      setResult("Sorry You Don't Qualify For The Airdrop.");
    }
  };

  const snapshotText = "Numbers are based on the initial March 31, 2025 snapshot of 1:10. We will update the numbers with the 1:1 as we get closer to launch.";

  const handleCopySnapshotText = () => {
    navigator.clipboard.writeText(snapshotText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset copied state after 2 seconds
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      // Optionally, provide user feedback that copy failed
    });
  };

  return (
    <main 
      className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 text-white"
      style={{
        backgroundImage: `url(${images[currentImageIndex].src})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        transition: 'background-image 1s ease-in-out', // Smooth transition
      }}
    >
      <div className="bg-gray-800 bg-opacity-85 p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md flex flex-col items-center"> {/* Increased opacity, added flex for centering logo*/}
        <img 
          className="h-72 mb-6" // Changed h-24 to h-72, kept mb-6
          src={NewLogo.src} 
          alt="DeFAI Rewards Logo" 
          style={{ filter: "brightness(0) invert(1)" }} 
        />
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center text-purple-400">$AIRdrop Eligibility</h1>
        
        <p className="text-center mb-4 text-gray-300 text-sm sm:text-base">
          Welcome to the DeFAIRewards $AIRdrop checker. Simply paste your wallet address in the box and click check AIRdrop to see what you will receive via Streamflow when we launch!
        </p>

        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter your wallet address"
          className="w-full p-3 mb-4 bg-gray-700 border border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500 outline-none text-white"
        />
        <button
          onClick={handleCheckAirdrop}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-md transition duration-150 ease-in-out mb-4" // Added margin-bottom
        >
          Check Airdrop
        </button>
        {result !== null && (
          <div className="mt-2 p-4 bg-gray-700 rounded-md text-center w-full">
            {typeof result === 'number' ? (
              <p className="text-lg">
                🎉 Congratulations! You will receive: <span className="font-bold text-xl text-green-400">{result.toLocaleString()}</span> $AIR tokens.
              </p>
            ) : (
              <p className="text-lg text-red-400">{result}</p>
            )}
          </div>
        )}

        <div className="mt-6 text-center">
          <p 
            className="text-xs text-gray-400 hover:text-purple-300 cursor-pointer"
            onClick={handleCopySnapshotText}
          >
            {snapshotText}
          </p>
          {copied && <span className="text-xs text-green-400 ml-2">Copied!</span>}
        </div>

      </div>
    </main>
  );
}
