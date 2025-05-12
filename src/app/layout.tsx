import { ThemeProviderWrapper } from "@/providers/themeProvider";
import { WalletAdapterProvider } from "@/providers/walletAdapterProvider";
import type { Metadata } from "next";
import { Inter, Orbitron, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { UmiProvider } from "@/providers/umiProvider";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import SessionProviderWrapper from "@/providers/sessionProviderWrapper";
import AppHeader from "@/components/layout/AppHeader";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const orbitron = Orbitron({ 
  subsets: ["latin"], 
  weight: ['400', '600', '700'],
  variable: '--font-orbitron'
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ['400', '700'],
  variable: '--font-space-grotesk'
});

export const metadata: Metadata = {
  title: "DeFAIRewards - Check Your $AIR Airdrop & Explore Decentralized Rewards!",
  description: "Discover your $AIR token airdrop eligibility with the DeFAIRewards checker. Stay tuned for more on our platform dedicated to decentralized finance rewards.",
  openGraph: {
    title: "DeFAIRewards - Check Your $AIR Airdrop & Explore Decentralized Rewards!",
    description: "Discover your $AIR token airdrop eligibility with the DeFAIRewards checker. Stay tuned for more on our platform dedicated to decentralized finance rewards.",
    images: [
      {
        url: '/logo.png',
        width: 800,
        height: 600,
        alt: 'DeFAIRewards Logo',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "DeFAIRewards - Check Your $AIR Airdrop & Explore Decentralized Rewards!",
    description: "Discover your $AIR token airdrop eligibility with the DeFAIRewards checker. Stay tuned for more on our platform dedicated to decentralized finance rewards.",
    images: ['/logo.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${orbitron.variable} ${spaceGrotesk.variable}`}>
      <body className={"flex flex-col min-h-screen gap-4 font-sans"}>
        <SessionProviderWrapper>
          <WalletAdapterProvider>
            <UmiProvider>
              <ThemeProviderWrapper>
                <AppHeader />
                <main className="pt-16">
                  {children}
                </main>
                <ShadcnToaster />
                <SonnerToaster richColors position="bottom-right" />
              </ThemeProviderWrapper>
            </UmiProvider>
          </WalletAdapterProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
