"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { ScoreCircle } from "@/components/ScoreCircle";
import { UsageBar } from "@/components/UsageBar";
import { MetricCard } from "@/components/MetricCard";
import { EmptyState } from "@/components/EmptyState";
import { UpgradeCard } from "@/components/UpgradeCard";

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

interface UsageResponse {
  plan: "FREE" | "PRO";
  scans: { thisMonth: number; thisWeek: number; maxMonth: number; maxWeek: number | null };
  sites: { total: number; thisMonth: number; maxMonth: number | null; unlimited: boolean };
}

export default function DashboardPage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanningId, setScanningId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [meRes, sitesRes, usageRes] = await Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/sites"),
      fetch("/api/usage"),
    ]);
    const me = await meRes.json();
    setUser(me.user);
    if (sitesRes.ok) setSites(await sitesRes.json());
    if (usageRes.ok) setUsage(await usageRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleScanNow(siteId: string) {
    setScanningId(siteId);
    await fetch(`/api/sites/${siteId}/scan`, { method: "POST" });
    await loadData();
    setScanningId(null);
  }

  async function handleUpgrade() {
    const response = await fetch("/api/billing/checkout", { method: "POST" });
    const data = await response.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error ?? "Pagamenti non disponibili al momento.");
  }

  if (loading || !user) {
    return <div className="p-10 text-center text-ink-soft">Caricamento...</div>;
  }

  const scoredSites = sites.filter((s) => s.lastScore != null);
  const avgScore =
    scoredSites.length > 0
      ? Math.round(scoredSites.reduce((sum, s) => sum + (s.lastScore ?? 0), 0) / scoredSites.length)
      : null;
  const recentIssueSites = sites
    .filter((s) => s.lastScore != null && s.lastScore < 60)
    .slice(0, 3);

  return (
    <DashboardShell user={user}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">Overview</h1>
          <p className="mt-1 text-sm text-ink-soft">Il tuo centro di controllo DigitalCheck.</p>
        </div>
        <Link
          href="/dashboard/analyze"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:bg-accent-deep"
        >
          + Nuova analisi
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Siti monitorati" value={sites.length} />
        <MetricCard label="Punteggio medio" value={avgScore ?? "—"} />
        <MetricCard
          label="Analisi questo mese"
          value={usage ? usage.scans.thisMonth : "—"}
          hint={usage ? `su ${usage.scans.maxMonth}` : undefined}
        />
        <MetricCard label="Piano attuale" value={user.plan === "PRO" ? "Pro" : "Free"} />
      </div>

      {usage && (
        <section className="mt-6 rounded-lg border border-line bg-white p-5">
          <h2 className="font-display text-lg">Utilizzo</h2>
          <div className="mt-4 space-y-4">
            {user.plan === "FREE" ? (
              <>
                <UsageBar label="Analisi questa settimana" used={usage.scans.thisWeek} max={usage.scans.maxWeek ?? 1} />
                <UsageBar
                  label="Nuovi siti questo mese"
                  used={usage.sites.thisMonth}
                  max={usage.sites.maxMonth ?? 1}
                />
              </>
            ) : (
              <UsageBar label="Analisi utilizzate questo mese" used={usage.scans.thisMonth} max={usage.scans.maxMonth} />
            )}
          </div>
        </section>
      )}

      {user.plan === "FREE" && (
        <div className="mt-6">
          <UpgradeCard
            title="Sblocca la piattaforma completa"
            description="Siti illimitati, fino a 200 analisi al mese, Assistente AI, report PDF completi, storico e Gestionale."
            onCtaClick={handleUpgrade}
          />
        </div>
      )}

      {recentIssueSites.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-lg">Criticita' principali</h2>
          <div className="mt-3 space-y-2">
            {recentIssueSites.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/site/${s.id}`}
                className="flex items-center justify-between rounded-lg border border-line bg-white p-4 hover:border-accent"
              >
                <span className="text-sm">{s.url}</span>
                <span className="text-sm font-medium text-severity-high">Score {s.lastScore}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg">I miei siti</h2>
        </div>

        {sites.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Non hai ancora nessun sito monitorato"
              description="Avvia la tua prima analisi per iniziare a tracciare i punteggi del tuo sito nel tempo."
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
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
        )}
      </section>
    </DashboardShell>
  );
}
