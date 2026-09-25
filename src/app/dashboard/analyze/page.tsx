"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { ReportView } from "@/components/ReportView";
import { UpgradeCard } from "@/components/UpgradeCard";
import type { DigitalCheckReport } from "@/types";

interface MeUser {
  id: string;
  email: string;
  plan: "FREE" | "PRO";
  isAdmin: boolean;
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

// Messaggi di attesa "onesti": non affermano il completamento di una
// fase specifica (il backend non espone uno stato progressivo reale),
// servono solo a rassicurare durante un'attesa indeterminata — vedi
// brief sezione 10.
const WAIT_MESSAGES = [
  "Stiamo raggiungendo il sito...",
  "Analisi tecnica e SEO in corso...",
  "Puo' richiedere qualche secondo, soprattutto per siti piu' grandi...",
  "Stiamo preparando il report...",
];

function normalizeUrl(input: string): string {
  const withProtocol = /^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`;
  try {
    const u = new URL(withProtocol);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return input.trim().toLowerCase();
  }
}

export default function AnalyzeSitePage() {
  const router = useRouter();
  const [user, setUser] = useState<MeUser | null>(null);
  const [url, setUrl] = useState("");
  const [businessType, setBusinessType] = useState<(typeof BUSINESS_TYPES)[number]["value"]>("bnb");
  const [goal, setGoal] = useState<(typeof GOALS)[number]["value"]>("increase_bookings");
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [report, setReport] = useState<DigitalCheckReport | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user));
  }, []);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = setInterval(() => setMessageIndex((i) => (i + 1) % WAIT_MESSAGES.length), 3200);
    return () => clearInterval(timer);
  }, [status]);

  async function handleUpgrade() {
    const response = await fetch("/api/billing/checkout", { method: "POST" });
    const data = await response.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error ?? "Pagamenti non disponibili al momento.");
  }

  const submittingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setStatus("loading");
    setError(null);
    setErrorCode(null);
    setReport(null);
    setMessageIndex(0);

    try {
      // Riusa un sito gia' tracciato con lo stesso URL invece di crearne
      // uno nuovo a ogni analisi: altrimenti ogni ri-analisi consumerebbe
      // anche la quota "nuovi siti/mese" del piano Free, non solo quella
      // delle analisi.
      const sitesRes = await fetch("/api/sites");
      const existingSites: { id: string; url: string }[] = sitesRes.ok ? await sitesRes.json() : [];
      const normalized = normalizeUrl(url);
      const existing = existingSites.find((s) => normalizeUrl(s.url) === normalized);

      let targetSiteId = existing?.id ?? null;

      if (!targetSiteId) {
        const createRes = await fetch("/api/sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, businessType, goal }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) {
          setError(createData.error ?? "Non e' stato possibile aggiungere il sito.");
          setErrorCode(createData.errorCode ?? null);
          setStatus("error");
          return;
        }
        targetSiteId = createData.id;
      }

      setSiteId(targetSiteId);
      const scanRes = await fetch(`/api/sites/${targetSiteId}/scan`, { method: "POST" });
      const scanData = await scanRes.json();
      if (!scanRes.ok) {
        setError(scanData.error ?? "Non e' stato possibile completare l'analisi.");
        setErrorCode(scanData.errorCode ?? null);
        setStatus("error");
        return;
      }
      if (!scanData.report) {
        setError("Analisi completata ma il report non e' disponibile.");
        setStatus("error");
        return;
      }
      setReport(scanData.report);
      setScanId(scanData.scanId ?? null);
      setStatus("done");
    } catch {
      setError("Non e' stato possibile completare l'analisi. Riprova tra poco.");
      setStatus("error");
    } finally {
      submittingRef.current = false;
    }
  }

  if (!user) return <div className="p-10 text-center text-ink-soft">Caricamento...</div>;

  return (
    <DashboardShell user={user}>
      <h1 className="font-display text-2xl">Analizza sito</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Inserisci l&apos;indirizzo del sito da analizzare: performance, SEO, accessibilita' e aspetti tecnici.
      </p>

      {status !== "done" && (
        <form onSubmit={handleSubmit} className="mt-6 max-w-xl space-y-3 rounded-[14px] border border-line bg-white p-6">
          <label htmlFor="url" className="text-sm text-ink-soft">
            URL del sito
          </label>
          <input
            id="url"
            type="text"
            required
            disabled={status === "loading"}
            placeholder="es. www.tuosito.it"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2.5 outline-none focus:border-accent disabled:opacity-60"
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="businessType" className="mb-1 block text-sm text-ink-soft">
                Tipo di attivita'
              </label>
              <select
                id="businessType"
                disabled={status === "loading"}
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value as typeof businessType)}
                className="w-full rounded-md border border-line px-3 py-2.5 outline-none focus:border-accent disabled:opacity-60"
              >
                {BUSINESS_TYPES.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="goal" className="mb-1 block text-sm text-ink-soft">
                Obiettivo principale
              </label>
              <select
                id="goal"
                disabled={status === "loading"}
                value={goal}
                onChange={(e) => setGoal(e.target.value as typeof goal)}
                className="w-full rounded-md border border-line px-3 py-2.5 outline-none focus:border-accent disabled:opacity-60"
              >
                {GOALS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-md bg-accent px-6 py-3 font-medium text-paper transition-colors hover:bg-accent-deep disabled:opacity-60"
          >
            {status === "loading" ? "Analisi in corso..." : "Analizza sito"}
          </button>

          {status === "loading" && (
            <div className="flex items-center justify-center gap-3 py-2" role="status">
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent"
                aria-hidden
              />
              <p className="text-sm text-ink-soft">{WAIT_MESSAGES[messageIndex]}</p>
            </div>
          )}

          {status === "error" && error && (
            <div className="space-y-3 rounded-md bg-severity-high/10 p-4" role="alert">
              <p className="text-sm text-severity-high">{error}</p>
              {(errorCode === "FREE_SCANS_WEEK_LIMIT" || errorCode === "FREE_SITES_MONTH_LIMIT") && (
                <UpgradeCard
                  title="Passa a Pro"
                  description="Analisi illimitate (fino a 200/mese) e siti illimitati, senza attese."
                  onCtaClick={handleUpgrade}
                  compact
                />
              )}
            </div>
          )}
        </form>
      )}

      {status === "done" && report && (
        <div className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-white p-4">
            <p className="text-sm text-ink-soft">Analisi completata.</p>
            <div className="flex gap-3">
              {siteId && (
                <Link href={`/dashboard/site/${siteId}`} className="text-sm text-accent hover:underline">
                  Vai al sito →
                </Link>
              )}
              <button
                onClick={() => {
                  setStatus("idle");
                  setReport(null);
                  setScanId(null);
                  setUrl("");
                }}
                className="text-sm text-ink-soft hover:text-ink"
              >
                Nuova analisi
              </button>
            </div>
          </div>
          <ReportView
            report={report}
            plan={user?.plan ?? "FREE"}
            onUpgrade={handleUpgrade}
            siteId={siteId ?? undefined}
            scanId={scanId ?? undefined}
          />
        </div>
      )}
    </DashboardShell>
  );
}
