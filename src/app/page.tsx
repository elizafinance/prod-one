"use client";

import { useState, useEffect } from 'react';
import SwapWrapper from "@/components/swapWrapper/swapWrapper";

// Import slide images
import slide1 from '@/assets/images/slide1_new.png';
import slide3 from '@/assets/images/slide_3.png';
import slide6 from '@/assets/images/slide_6.png';
import slide7 from '@/assets/images/slide_7.png';
import slide8 from '@/assets/images/slide_8.png';
import slide9 from '@/assets/images/slide_9.png';
import slide11 from '@/assets/images/slide_11.png';
// Note: Header was imported but not used. Keeping it out for now unless needed.

const images = [
  slide1,
  slide3,
  slide6,
  slide7,
  slide8,
  slide9,
  slide11,
];

export default function Home() {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, []);

  return (
    <main
      className="flex flex-col flex-1 items-center p-8 gap-4 w-full"
      style={{
        backgroundImage: `url(${images[currentImageIndex].src})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        transition: 'background-image 1s ease-in-out', // Smooth transition
      }}
    >
      <div className="flex flex-1 h-full items-center justify-center w-full bg-black bg-opacity-50 p-8 rounded-lg"> {/* Added a semi-transparent overlay for better content readability */}
        <SwapWrapper />
      </div>
    </main>
  );
}
