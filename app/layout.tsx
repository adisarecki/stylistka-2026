import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MarketProvider } from "@/components/MarketContext";

const serperKey = process.env.SERPER_API_KEY;
if (!serperKey) console.warn("BRAK KLUCZA: SERPER_API_KEY w .env.local");
if (serperKey) console.log("ENV CHECK: Silnik wyszukiwania (Serper) skonfigurowany.");

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Stylistka 2026 — AI Personal Stylist & Wirtualna Przymierzalnia (Beta)",
  description: "Inteligentna analiza sylwetki i personalizowany dobór stylizacji. Odkrywaj ubrania dopasowane do Twoich proporcji i okazji.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MarketProvider>
          {children}
        </MarketProvider>
      </body>
    </html>
  );
}
