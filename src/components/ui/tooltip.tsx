"use client";
import React from 'react';

// Minimal placeholder for TooltipProvider
export const TooltipProvider: React.FC<{ children: React.ReactNode; [key: string]: any; }> = ({ children }) => <>{children}</>;
TooltipProvider.displayName = 'TooltipProvider';

// Minimal placeholder for Tooltip
export const Tooltip: React.FC<{ children: React.ReactNode; [key: string]: any; }> = ({ children }) => <>{children}</>;
Tooltip.displayName = 'Tooltip';

// Minimal placeholder for TooltipTrigger
export const TooltipTrigger = React.forwardRef<HTMLElement, { children: React.ReactNode; asChild?: boolean; [key: string]: any; }>(({ children, asChild, ...props }, ref) => {
  if (asChild && React.isValidElement(children)) {
    // If asChild, assume children can take a ref and spread props. This is a common pattern for Radix-like components.
    return React.cloneElement(children as React.ReactElement<any>, { ref, ...props });
  }
  // Default to a button if not asChild or children is not a single valid element
  return <button ref={ref as React.Ref<HTMLButtonElement>} {...props}>{children}</button>;
});
TooltipTrigger.displayName = 'TooltipTrigger';

// Minimal placeholder for TooltipContent
export const TooltipContent = React.forwardRef<HTMLDivElement, { children: React.ReactNode; [key: string]: any; }>(({ children, ...props }, ref) => (
  <div ref={ref} {...props} style={{ display: 'none' }}> {/* Hidden by default */}
    {children}
  </div>
));
TooltipContent.displayName = 'TooltipContent'; 