"use client";

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import AppHeader from './AppHeader';

export default function ConditionalAppHeader() {
  const { status } = useSession();
  const pathname = usePathname();

  // Hide header only on home page ("/") when the user is NOT authenticated
  const hideHeader = pathname === '/' && status !== 'authenticated';

  if (hideHeader) {
    return null;
  }

  return <AppHeader />;
} 