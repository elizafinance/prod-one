"use client";

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton'; // For loading state

interface KpiTileProps {
  title: string;
  value: string | number | undefined | null;
  icon?: React.ElementType;
  unit?: string; // e.g., "AIR", "$"
  isLoading?: boolean;
  className?: string;
  valueClassName?: string;
  titleClassName?: string;
  aspectRatio?: string; // e.g., 'aspect-square', 'aspect-video', 'aspect-[4/3]'
  pctComplete?: number; // Percentage (0-100) for radial progress
}

const KpiTile: React.FC<KpiTileProps> = ({
  title,
  value,
  icon: Icon,
  unit,
  isLoading = false,
  className = '' ,
  valueClassName = 'text-2xl md:text-3xl font-bold text-foreground',
  titleClassName = 'text-sm text-muted-foreground mb-1',
  aspectRatio = 'aspect-square', // Default to square
  pctComplete,
}) => {
  const showProgress = typeof pctComplete === 'number' && pctComplete >= 0 && pctComplete <= 100;
  const conicGradient = `conic-gradient(var(--primary) ${pctComplete}%, var(--border) ${pctComplete}%)`;

  return (
    <div 
      className={`relative bg-card border border-border rounded-xl shadow-lg p-3 sm:p-4 flex flex-col justify-between items-start ${aspectRatio} ${className}`}
    >
      {showProgress && (
        <div 
          className="absolute top-2 right-2 w-8 h-8 rounded-full"
          style={{ background: conicGradient }}
          role="progressbar"
          aria-valuenow={pctComplete}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="absolute inset-0.5 bg-card rounded-full"></div> {/* Inner circle to make it a ring */}
        </div>
      )}
      <div>
        <div className={`flex items-center justify-between w-full ${Icon ? 'mb-2' : 'mb-1'}`}>
            <h4 className={titleClassName}>{title}</h4>
            {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
        </div>
        {isLoading ? (
          <Skeleton className={`h-8 w-3/4 rounded ${unit ? 'mb-1' : ''}`} />
        ) : (
          <p className={valueClassName}>
            {value ?? '-'}{unit && value !== null && value !== undefined ? <span className="text-lg md:text-xl ml-1">{unit}</span> : ''}
          </p>
        )}
      </div>
      {/* Can add a small footer or trend indicator here if needed later */}
    </div>
  );
};

export default KpiTile; 