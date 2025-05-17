"use client";
import React from 'react';

export const Separator: React.FC<{ className?: string }> = ({ className }) => (
  <hr className={className ?? 'my-4 border-border'} />
); 