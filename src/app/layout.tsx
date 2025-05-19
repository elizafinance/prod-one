import { ThemeProviderWrapper } from "@/providers/themeProvider";
import { WalletAdapterProvider } from "@/providers/walletAdapterProvider";
import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { UmiProvider } from "@/providers/umiProvider";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import SessionProviderWrapper from "@/providers/sessionProviderWrapper";
import ConditionalAppHeader from "@/components/layout/ConditionalAppHeader";
import SafeAreaView from "@/components/layout/SafeAreaView";
import BottomTabBar from "@/components/layout/BottomTabBar";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const orbitron = Orbitron({ 
  subsets: ["latin"], 
  weight: ['400', '600', '700'],
  variable: '--font-orbitron'
});

export const metadata: Metadata = {
  metadataBase: new URL('https://squad.defairewards.net'),
  title: "DeFAI Rewards - Banking AI Agents. Rewarding Humans",
  description: "DeFAI Rewards is a futuristic AI-powered rewards platform, where banking AI agents reward humans.",
  openGraph: {
    title: "DeFAI Rewards - Banking AI Agents. Rewarding Humans",
    description: "DeFAI Rewards is a futuristic AI-powered rewards platform, where banking AI agents reward humans.",
    images: [
      {
        url: '/ai-image.jpeg',
        width: 800,
        height: 600,
        alt: 'DeFAI Rewards Hero',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "DeFAI Rewards - Banking AI Agents. Rewarding Humans",
    description: "DeFAI Rewards is a futuristic AI-powered rewards platform, where banking AI agents reward humans.",
    images: ['/ai-image.jpeg'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${orbitron.variable}`} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png"></link>
        {/* Theme color for browser UI based on current theme could also be added here if desired */}
        {/* <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" /> */}
        {/* <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" /> */}
      </head>
      <body className="flex flex-col min-h-screen font-sans bg-background text-foreground">
        <SessionProviderWrapper>
          <WalletAdapterProvider>
            <UmiProvider>
              <ThemeProviderWrapper>
                <div className="hidden lg:block">
                  <ConditionalAppHeader />
                </div>
                <SafeAreaView className="bg-background pb-16 lg:pb-0 lg:pt-20">
                  {children}
                </SafeAreaView>
                <ShadcnToaster />
                <SonnerToaster richColors position="bottom-right" />
                <div className="lg:hidden">
                  <BottomTabBar />
                </div>
              </ThemeProviderWrapper>
            </UmiProvider>
          </WalletAdapterProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
