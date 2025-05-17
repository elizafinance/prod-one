"use client";
import React from 'react';

export const DashboardShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
    {children}
  </div>
); 