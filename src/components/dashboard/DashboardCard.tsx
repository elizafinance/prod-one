"use client";

import React from 'react';

interface DashboardCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  title?: string;
  titleClassName?: string;
  contentClassName?: string;
  // Add other props like actions (e.g., a settings icon button) if needed later
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  children,
  title,
  className = '' , // Default to empty string if not provided
  titleClassName = 'text-lg font-semibold text-foreground mb-3', // Default title style
  contentClassName = '', // Default content style
  ...props
}) => {
  return (
    <div 
      className={`bg-card border border-border rounded-xl shadow-lg p-4 sm:p-6 ${className}`}
      {...props}
    >
      {title && (
        <h3 className={titleClassName}>
          {title}
        </h3>
      )}
      <div className={contentClassName}>
        {children}
      </div>
    </div>
  );
};

export default DashboardCard; 