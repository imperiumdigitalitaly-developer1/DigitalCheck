import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crea il tuo account",
  description: "Registrati gratis su DigitalCheck e analizza il tuo sito su 8 aree — SEO, performance, mobile, contenuti, conversione, accessibilità, tecnica e GEO.",
  alternates: { canonical: "/register" },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
