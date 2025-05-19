"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, useScroll, useTransform } from 'framer-motion';

// Placeholder for a default banner
const DEFAULT_SQUAD_BANNER_URL = '/images/squads/default-banner.jpg'; // TODO: Add a real default banner image here
const EXPANDED_HEADER_HEIGHT = 220;
const COLLAPSED_HEADER_HEIGHT = 60; // Standard nav bar height
const SCROLL_THRESHOLD_OFFSET = 10; // Pixels before full collapse to trigger effect

interface CollapsibleSquadHeaderProps {
  squadName: string;
  squadDescription?: string;
  bannerImageUrl?: string;
  scrollTargetRef?: React.RefObject<HTMLElement>; // Optional ref for a specific scroll container
}

const CollapsibleSquadHeader: React.FC<CollapsibleSquadHeaderProps> = ({
  squadName,
  squadDescription,
  bannerImageUrl = DEFAULT_SQUAD_BANNER_URL,
  scrollTargetRef,
}) => {
  const { scrollY } = useScroll({
    target: scrollTargetRef, // Use passed ref if available, otherwise defaults to window
    // offset: ["start start", "end start"] // Default offset should be fine
  });

  // Parallax for the banner image
  const bannerScale = useTransform(scrollY, [0, EXPANDED_HEADER_HEIGHT], [1.05, 1.25]); // Zoom in slightly on scroll
  const bannerY = useTransform(scrollY, [0, EXPANDED_HEADER_HEIGHT], [0, -50]); // Move image up a bit slower than scroll

  // Opacity for the main header content (fade out as it collapses)
  const contentOpacity = useTransform(scrollY, [0, EXPANDED_HEADER_HEIGHT / 2.5], [1, 0]); // Fade out quicker
  const contentY = useTransform(scrollY, [0, EXPANDED_HEADER_HEIGHT / 2.5], [0, 20]); // Move content down and out

  // Height of the overall header container
  const headerHeight = useTransform(
    scrollY,
    [0, EXPANDED_HEADER_HEIGHT - COLLAPSED_HEADER_HEIGHT],
    [EXPANDED_HEADER_HEIGHT, COLLAPSED_HEADER_HEIGHT],
    { clamp: true } // Prevent height from going below COLLAPSED_HEADER_HEIGHT
  );
  
  // Opacity for the collapsed nav bar title (fade in)
  const collapsedNavOpacity = useTransform(
    scrollY,
    [EXPANDED_HEADER_HEIGHT - COLLAPSED_HEADER_HEIGHT - SCROLL_THRESHOLD_OFFSET, EXPANDED_HEADER_HEIGHT - COLLAPSED_HEADER_HEIGHT],
    [0, 1]
  );
   const collapsedNavY = useTransform(
    scrollY,
    [EXPANDED_HEADER_HEIGHT - COLLAPSED_HEADER_HEIGHT - SCROLL_THRESHOLD_OFFSET, EXPANDED_HEADER_HEIGHT - COLLAPSED_HEADER_HEIGHT],
    [10, 0] // Slide in from top
  );

  // State to control conditional classes for backdrop and shadow
  const [isActuallyCollapsed, setIsActuallyCollapsed] = useState(false);

  useEffect(() => {
    const unsubscribe = scrollY.on("change", (latest) => {
      setIsActuallyCollapsed(latest >= EXPANDED_HEADER_HEIGHT - COLLAPSED_HEADER_HEIGHT - SCROLL_THRESHOLD_OFFSET);
    });
    return () => unsubscribe();
  }, [scrollY]);

  // Motion value for the background opacity of the collapsed nav, can be used directly in style
  const collapsedNavBackgroundOpacity = useTransform(scrollY, 
    [EXPANDED_HEADER_HEIGHT - COLLAPSED_HEADER_HEIGHT - SCROLL_THRESHOLD_OFFSET, EXPANDED_HEADER_HEIGHT - COLLAPSED_HEADER_HEIGHT],
    [0,1]
  );

  return (
    <motion.div
      className="sticky top-0 z-30 w-full text-foreground overflow-hidden bg-background group"
      style={{ height: headerHeight }}
    >
      {/* Banner Image */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{
          scale: bannerScale,
          y: bannerY,
        }}
      >
        <Image
          src={bannerImageUrl}
          alt={`${squadName} banner image`}
          layout="fill"
          objectFit="cover"
          priority // Important for LCP if this is above the fold
          // className="transition-transform duration-500 ease-out group-hover:scale-105" // Remove as framer-motion handles transform
        />
      </motion.div>
      {/* Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent z-10"></div>

      {/* Expanded Content positioned at the bottom of the header */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 z-20 p-4 sm:p-6"
        style={{
          opacity: contentOpacity,
          y: contentY,
        }}
      >
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold font-orbitron text-white drop-shadow-lg"> {/* Explicitly text-white for contrast */}
          {squadName}
        </h1>
        {squadDescription && (
          <p className="text-sm sm:text-base text-slate-200 mt-1 max-w-2xl truncate drop-shadow-md">
            {squadDescription}
          </p>
        )}
      </motion.div>

      {/* Collapsed Navigation Bar Content */}
      <motion.div
        className="absolute top-0 left-0 right-0 h-[60px] flex items-center justify-center z-30 px-4 sm:px-6"
        style={{
          opacity: collapsedNavOpacity,
          y: collapsedNavY,
          // Becomes visible and styled when header is sufficiently collapsed
          // Add backdrop-blur and shadow when scrollY indicates collapsed state
        }}
        // Conditional styling for backdrop and shadow:
        // We can't directly use useTransform for classNames, so this might need a state or useEffect
        // For simplicity in this edit, I'll add the classes directly and rely on opacity.
        // A more robust solution would use a `useEffect` to toggle classes or use `motion.custom`.
      >
        {/* Background for collapsed nav with conditional blur and shadow */}
        <motion.div 
          className={`absolute inset-0 w-full h-full ${isActuallyCollapsed ? 'backdrop-blur-md shadow-lg' : ''}`}
          style={{ opacity: collapsedNavBackgroundOpacity }}
        >
          <div className={`absolute inset-0 bg-background/80 ${isActuallyCollapsed ? '' : 'opacity-0'}`}></div>
        </motion.div>

        <h2 className="text-xl font-semibold font-orbitron text-foreground relative z-10"> {/* Use design token */}
          {squadName}
        </h2>
        {/* Potentially add back button or other nav items here */}
      </motion.div>
      
    </motion.div>
  );
};

export default CollapsibleSquadHeader; 