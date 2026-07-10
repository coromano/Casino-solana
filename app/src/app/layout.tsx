import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppWalletProvider from "../components/AppWalletProvider"; // <--- IMPORTAR
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Casino Block Tower",
  description: "Juego de física en Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Envolvemos todo en el Provider */}
        <AppWalletProvider>
            {children}
        </AppWalletProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}