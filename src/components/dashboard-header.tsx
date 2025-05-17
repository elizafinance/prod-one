"use client";
import React from 'react';

export const DashboardHeader: React.FC<{ heading: string; text?: string }> = ({ heading, text }) => (
  <div className="mb-6">
    <h1 className="text-3xl font-bold tracking-tight text-foreground">{heading}</h1>
    {text && <p className="text-muted-foreground mt-1">{text}</p>}
  </div>
); 