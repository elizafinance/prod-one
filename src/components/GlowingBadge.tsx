'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface GlowingBadgeProps {
  icon: string;
  label: string;
  color: string;
  glowColor: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const GlowingBadge: React.FC<GlowingBadgeProps> = ({
  icon,
  label,
  color,
  glowColor,
  size = 'md',
  className = '',
}) => {
  // Size classes for the badge
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };
  
  return (
    <motion.span
      className={`font-semibold rounded-full inline-block relative ${sizeClasses[size]} ${color} ${className}`}
      style={{
        boxShadow: `0 0 10px ${glowColor}, 0 0 20px ${glowColor}`,
      }}
      animate={{
        boxShadow: [
          `0 0 5px ${glowColor}, 0 0 10px ${glowColor}`,
          `0 0 15px ${glowColor}, 0 0 25px ${glowColor}`,
          `0 0 5px ${glowColor}, 0 0 10px ${glowColor}`,
        ],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      {icon} {label}
    </motion.span>
  );
};

export default GlowingBadge; 