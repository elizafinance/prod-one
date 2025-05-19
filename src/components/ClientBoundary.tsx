"use client";

import { useEffect, useState } from 'react';

interface ClientBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function ClientBoundary({ children, fallback = null }: ClientBoundaryProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return fallback;
  }

  return <>{children}</>;
} 