import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recupera password",
  description: "Recupera l'accesso al tuo account DigitalCheck impostando una nuova password.",
  alternates: { canonical: "/reset-password" },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
