import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accedi",
  description: "Accedi al tuo account DigitalCheck per consultare le analisi dei tuoi siti, il Digital Score e i report generati.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
