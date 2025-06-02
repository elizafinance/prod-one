import { ThemeProviderWrapper } from "@/providers/themeProvider";
import { WalletAdapterProvider } from "@/providers/walletAdapterProvider";
import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { UmiProvider } from "@/providers/umiProvider";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import SessionProviderWrapper from "@/providers/sessionProviderWrapper";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import AgentSetupModal from "@/components/modals/AgentSetupModal";
// import CrossmintProviders from "@/providers/CrossmintProviders"; // Now scoped to Yield page

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const orbitron = Orbitron({ 
  subsets: ["latin"], 
  weight: ['400', '600', '700'],
  variable: '--font-orbitron'
});

export const metadata: Metadata = {
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
      <head />
      <body className={`${inter.className} font-sans`}>
        {/* <CrossmintProviders> */}
        <SessionProviderWrapper>
          <WalletAdapterProvider>
            <UmiProvider>
              <ThemeProviderWrapper>
                <SidebarProvider>
                  <AppSidebar />
                  {children}
                </SidebarProvider>
                <ShadcnToaster />
                <SonnerToaster richColors position="bottom-right" />
                <AgentSetupModal />
              </ThemeProviderWrapper>
            </UmiProvider>
          </WalletAdapterProvider>
        </SessionProviderWrapper>
        {/* </CrossmintProviders> */}
      </body>
    </html>
  );
}
