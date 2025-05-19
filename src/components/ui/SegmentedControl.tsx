"use client";

import React from 'react';

interface SegmentedControlOption<T extends string> {
  label: string;
  value: T;
  icon?: React.ElementType; // Optional icon for each segment
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  segmentClassName?: string;
  activeSegmentClassName?: string;
  inactiveSegmentClassName?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className = 'flex w-full max-w-md mx-auto p-1 bg-muted rounded-lg shadow-sm',
  segmentClassName = 'flex-1 text-center px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-defai_primary',
  activeSegmentClassName = 'bg-background text-defai_primary shadow',
  inactiveSegmentClassName = 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
}: SegmentedControlProps<T>) {
  return (
    <div className={className}>
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`
            ${segmentClassName}
            ${value === option.value ? activeSegmentClassName : inactiveSegmentClassName}
          `}
          aria-pressed={value === option.value}
        >
          {option.icon && <option.icon className="h-4 w-4 inline mr-1.5 mb-0.5" />}
          {option.label}
        </button>
      ))}
    </div>
  );
} 