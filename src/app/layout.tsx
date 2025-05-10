import { ThemeProviderWrapper } from "@/providers/themeProvider";
import { WalletAdapterProvider } from "@/providers/walletAdapterProvider";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { UmiProvider } from "@/providers/umiProvider";
// import Header from "@/components/header";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Metaplex Umi Next.js",
  description: "Metaplex template for Next.js using Umi",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <WalletAdapterProvider>
      <UmiProvider>
        <html lang="en">
          <body
            className={inter.className + " flex flex-col min-h-screen gap-4"}
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
