import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { ChatWidget } from "@/components/ChatWidget";

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

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
  title: "DigitalCheck — Scopri quanto e' efficace il tuo sito",
  description:
    "Analizza SEO, performance, mobile, contenuti e capacita' di conversione del sito della tua attivita'. Ottieni un report chiaro e indicazioni concrete per migliorare.",
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
