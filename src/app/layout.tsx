import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { ChatWidget } from "@/components/ChatWidget";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600"],
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "DigitalCheck — Website analysis e SEO audit con AI",
    template: "%s · DigitalCheck",
  },
  description:
    "DigitalCheck (powered by Imperium Digital) analizza SEO, performance, accessibilita' e aspetti tecnici del tuo sito con dati reali PageSpeed e interpretazione AI. Report chiaro, indicazioni operative, piano gratuito disponibile.",
  keywords: [
    "website analysis",
    "website audit",
    "SEO audit",
    "PageSpeed analysis",
    "website performance",
    "AI website analysis",
    "DigitalCheck",
  ],
  openGraph: {
    title: "DigitalCheck — Website analysis e SEO audit con AI",
    description:
      "Analizza performance, SEO, accessibilita' e aspetti tecnici del tuo sito in pochi secondi, con interpretazione AI dei risultati.",
    siteName: "DigitalCheck",
    locale: "it_IT",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${fraunces.variable} ${plexSans.variable}`}>
      <body className="bg-paper text-ink font-body antialiased">
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
