import { ThemeProviderWrapper } from "@/providers/themeProvider";
import { WalletAdapterProvider } from "@/providers/walletAdapterProvider";
import type { Metadata } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";
import { UmiProvider } from "@/providers/umiProvider";
// import Header from "@/components/header";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const orbitron = Orbitron({ 
  subsets: ["latin"], 
  weight: ['400', '600', '700'],
  variable: '--font-orbitron'
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
    <WalletAdapterProvider>
      <UmiProvider>
        <html lang="en" className={`${inter.variable} ${orbitron.variable}`}>
          <body
            className={"flex flex-col min-h-screen gap-4 font-sans"}
          >
            <ThemeProviderWrapper>
              {/* <div className="flex flex-col items-center pt-24 gap-4 w-full">
                <Header />
              </div> */}
              {children}
              <Toaster />
            </ThemeProviderWrapper>
          </body>
        </html>
      </UmiProvider>
    </WalletAdapterProvider>
  );
}
