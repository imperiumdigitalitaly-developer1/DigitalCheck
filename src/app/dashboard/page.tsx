"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScoreCircle } from "@/components/ScoreCircle";

interface MeUser {
  id: string;
  email: string;
  plan: "FREE" | "PRO";
  isAdmin: boolean;
}

interface SiteListItem {
  id: string;
  url: string;
  businessType: string;
  goal: string;
  monitoringEnabled: boolean;
  lastScore: number | null;
  previousScore: number | null;
  lastScanAt: string | null;
  lastScanStatus: string | null;
}

const BUSINESS_TYPES = [
  { value: "bnb", label: "B&B / Casa vacanze" },
  { value: "hotel", label: "Hotel" },
  { value: "restaurant", label: "Ristorante" },
  { value: "shop", label: "Negozio" },
  { value: "professional", label: "Professionista" },
  { value: "other", label: "Altro" },
] as const;

const GOALS = [
  { value: "increase_bookings", label: "Ricevere piu' prenotazioni" },
  { value: "increase_calls", label: "Ricevere piu' telefonate" },
  { value: "increase_quote_requests", label: "Ricevere piu' richieste di preventivo" },
  { value: "increase_visibility", label: "Aumentare la visibilita' online" },
  { value: "sell_products", label: "Vendere prodotti" },
  { value: "increase_contacts", label: "Ottenere piu' contatti" },
] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newBusinessType, setNewBusinessType] = useState<(typeof BUSINESS_TYPES)[number]["value"]>("bnb");
  const [newGoal, setNewGoal] = useState<(typeof GOALS)[number]["value"]>("increase_bookings");
  const [formError, setFormError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [meRes, sitesRes] = await Promise.all([fetch("/api/auth/me"), fetch("/api/sites")]);
    const me = await meRes.json() as any;
    setUser(me.user);
    if (sitesRes.ok) setSites(await sitesRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  async function handleAddSite(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const response = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: newUrl, businessType: newBusinessType, goal: newGoal }),
    });
    const data = await response.json() as any;
    if (!response.ok) {
      setFormError(data.error ?? "Non e' stato possibile aggiungere il sito.");
      return;
    }
    setNewUrl("");
    setShowAddForm(false);
    await loadData();
  }

  async function handleScanNow(siteId: string) {
    setScanningId(siteId);
    await fetch(`/api/sites/${siteId}/scan`, { method: "POST" });
    await loadData();
    setScanningId(null);
  }

  async function handleUpgrade() {
    const response = await fetch("/api/billing/checkout", { method: "POST" });
    const data = await response.json() as any;
    if (data.url) window.location.href = data.url;
    else alert(data.error ?? "Pagamenti non disponibili al momento.");
  }

  if (loading) {
    return <div className="p-10 text-center text-ink-soft">Caricamento...</div>;
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/dashboard" className="font-display text-xl">
            DigitalCheck
          </Link>
          <div className="flex items-center gap-4 text-sm">
            {user?.isAdmin && (
              <Link href="/admin" className="text-ink-soft hover:text-ink">
                Admin
              </Link>
            )}
            <span className="rounded-full bg-accent-soft px-3 py-1 text-accent-deep">
              Piano {user?.plan === "PRO" ? "Pro" : "Free"}
            </span>
            {user?.plan === "FREE" && (
              <button onClick={handleUpgrade} className="text-accent hover:underline">
                Passa a Pro
              </button>
            )}
            <span className="text-ink-soft">{user?.email}</span>
            <button onClick={handleLogout} className="text-ink-soft hover:text-ink">
              Esci
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl">I tuoi siti</h1>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:bg-accent-deep"
          >
            + Aggiungi sito
          </button>
        </div>

        {showAddForm && (
          <form onSubmit={handleAddSite} className="mt-4 space-y-3 rounded-lg border border-line bg-white p-5">
            <input
              type="text"
              required
              placeholder="URL del sito"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full rounded-md border border-line px-3 py-2 outline-none focus:border-accent"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={newBusinessType}
                onChange={(e) => setNewBusinessType(e.target.value as typeof newBusinessType)}
                className="rounded-md border border-line px-3 py-2 outline-none focus:border-accent"
              >
                {BUSINESS_TYPES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
              <select
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value as typeof newGoal)}
                className="rounded-md border border-line px-3 py-2 outline-none focus:border-accent"
              >
                {GOALS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            {formError && <p className="text-sm text-severity-high">{formError}</p>}
            <button type="submit" className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper">
              Salva sito
            </button>
          </form>
        )}

        {sites.length === 0 && !showAddForm && (
          <p className="mt-8 text-ink-soft">
            Non hai ancora nessun sito monitorato. Aggiungine uno per iniziare.
          </p>
        )}

        <div className="mt-6 space-y-3">
          {sites.map((site) => {
            const delta =
              site.lastScore != null && site.previousScore != null ? site.lastScore - site.previousScore : null;
            return (
              <div
                key={site.id}
                className="flex flex-col items-start gap-4 rounded-lg border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-4">
                  {site.lastScore != null ? (
                    <ScoreCircle score={site.lastScore} size={64} />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line text-xs text-ink-soft">
                      N/D
                    </div>
                  )}
                  <div>
                    <Link href={`/dashboard/site/${site.id}`} className="font-medium hover:text-accent">
                      {site.url}
                    </Link>
                    <p className="text-sm text-ink-soft">
                      {site.lastScanAt
                        ? `Ultima scansione: ${new Date(site.lastScanAt).toLocaleDateString("it-IT")}`
                        : "Nessuna scansione ancora eseguita"}
                      {delta != null && (
                        <span className={delta >= 0 ? " text-score-strong" : " text-severity-high"}>
                          {" "}
                          ({delta >= 0 ? "+" : ""}
                          {delta})
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleScanNow(site.id)}
                  disabled={scanningId === site.id}
                  className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent disabled:opacity-60"
                >
                  {scanningId === site.id ? "Scansione in corso..." : "Scansiona ora"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
