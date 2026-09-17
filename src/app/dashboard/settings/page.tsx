"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";

interface MeUser {
  id: string;
  email: string;
  plan: "FREE" | "PRO";
  isAdmin: boolean;
  emailVerified: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalMessage, setPortalMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user);
        setLoading(false);
      });
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function handleUpgrade() {
    const response = await fetch("/api/billing/checkout", { method: "POST" });
    const data = await response.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error ?? "Pagamenti non disponibili al momento.");
  }

  async function handleManageSubscription() {
    setPortalMessage(null);
    const response = await fetch("/api/billing/portal", { method: "POST" });
    const data = await response.json();
    if (data.url) window.location.href = data.url;
    else setPortalMessage(data.error ?? "Gestione abbonamento non disponibile al momento.");
  }

  if (loading || !user) return <div className="p-10 text-center text-ink-soft">Caricamento...</div>;

  return (
    <DashboardShell user={user}>
      <h1 className="font-display text-2xl">Impostazioni</h1>

      <section className="mt-6 max-w-lg space-y-4 rounded-lg border border-line bg-white p-6">
        <h2 className="font-display text-lg">Account</h2>
        <div>
          <p className="text-sm text-ink-soft">Email</p>
          <p className="text-sm">{user.email}</p>
        </div>
        <div>
          <p className="text-sm text-ink-soft">Email verificata</p>
          <p className="text-sm">{user.emailVerified ? "Si'" : "No"}</p>
        </div>
        <a href="/reset-password" className="inline-block text-sm text-accent hover:underline">
          Cambia password →
        </a>
      </section>

      <section className="mt-6 max-w-lg space-y-4 rounded-lg border border-line bg-white p-6">
        <h2 className="font-display text-lg">Abbonamento</h2>
        <p className="text-sm">
          Piano attuale: <span className="font-medium">{user.plan === "PRO" ? "DigitalCheck Pro" : "Free"}</span>
        </p>
        {user.plan === "PRO" ? (
          <button
            onClick={handleManageSubscription}
            className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent"
          >
            Gestisci abbonamento
          </button>
        ) : (
          <button
            onClick={handleUpgrade}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:bg-accent-deep"
          >
            Passa a Pro — 6,99 €/mese
          </button>
        )}
        {portalMessage && <p className="text-sm text-ink-soft">{portalMessage}</p>}
      </section>

      <section className="mt-6 max-w-lg rounded-lg border border-line bg-white p-6">
        <button onClick={handleLogout} className="text-sm text-ink-soft hover:text-ink">
          Esci dall&apos;account
        </button>
      </section>
    </DashboardShell>
  );
}
