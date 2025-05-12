"use client";

import { SessionProvider } from "next-auth/react";
import React from "react";

interface Props {
  children: React.ReactNode;
}

export default function SessionProviderWrapper({ children }: Props) {
  return <SessionProvider>{children}</SessionProvider>;
} 