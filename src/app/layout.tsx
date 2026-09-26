import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ChatWidget } from "@/components/ChatWidget";
import { SITE_URL } from "@/lib/seo/site";

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

// Usato nella landing page per i dati numerici (Digital Score, punteggi
// per categoria): cifre tabellari, coerente con l'estetica "da app".
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
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
  verification: {
    google: "I1jUdFPdVpVWIsvhMDE-r2wT-1w0ibFs7HK6gc4BEJU",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable}`}>
      <body className="bg-paper text-ink font-body antialiased">
        {children}
        <ChatWidget />
      </body>
    </html>
  );
}
