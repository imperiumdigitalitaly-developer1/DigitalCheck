"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { MetricCard } from "@/components/MetricCard";
import { EmptyState } from "@/components/EmptyState";
import { UpgradeCard } from "@/components/UpgradeCard";
import { StatusBadge } from "@/components/StatusBadge";
import { ScoreTrendChart } from "@/components/ScoreTrendChart";
import { CATEGORY_LABELS } from "@/lib/category-labels";

interface MeUser {
  id: string;
  email: string;
  plan: "FREE" | "PRO";
  isAdmin: boolean;
}

interface SiteListItem {
  id: string;
  url: string;
}

type Tab = "overview" | "analytics" | "search-console" | "metrics" | "observability";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "analytics", label: "Web Analytics" },
  { key: "search-console", label: "Search Console" },
  { key: "metrics", label: "Metrics" },
  { key: "observability", label: "Observability" },
];

interface OverviewData {
  totalSites: number;
  avgScore: number | null;
  recentScans: { siteId: string; url: string; score: number | null; date: string | null }[];
  recurringIssues: { title: string; siteCount: number }[];
  alerts: { id: string; type: string; message: string; createdAt: string; read: boolean }[];
}

interface MetricsData {
  points: { scanId: string; date: string; overallScore: number | null; categoryScores: Record<string, number> }[];
  trendNote: string | null;
}

interface ConnectionsData {
  analytics: { connected: boolean };
  searchConsole: { connected: boolean };
  monitoring: { configured: boolean };
}

export default function GestionalePage() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [connections, setConnections] = useState<ConnectionsData | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/auth/me").then((r) => r.json()), fetch("/api/sites").then((r) => (r.ok ? r.json() : []))]).then(
      ([me, siteList]) => {
        setUser(me.user);
        setSites(siteList);
        if (siteList[0]) setSelectedSiteId(siteList[0].id);
        setLoading(false);
      }
    );
  }, []);

  const loadOverview = useCallback(async () => {
    const res = await fetch("/api/gestionale/overview");
    if (res.ok) setOverview(await res.json());
  }, []);

  const loadMetrics = useCallback(async (siteId: string) => {
    if (!siteId) return;
    const res = await fetch(`/api/gestionale/metrics?siteId=${siteId}`);
    if (res.ok) setMetrics(await res.json());
  }, []);

  const loadConnections = useCallback(async (siteId: string) => {
    if (!siteId) return;
    const res = await fetch(`/api/gestionale/connections?siteId=${siteId}`);
    if (res.ok) setConnections(await res.json());
  }, []);

  useEffect(() => {
    if (user?.plan !== "PRO") return;
    if (tab === "overview") loadOverview();
    if (tab === "metrics") loadMetrics(selectedSiteId);
    if (tab === "analytics" || tab === "search-console" || tab === "observability") loadConnections(selectedSiteId);
  }, [tab, selectedSiteId, user, loadOverview, loadMetrics, loadConnections]);

  async function handleUpgrade() {
    const response = await fetch("/api/billing/checkout", { method: "POST" });
    const data = await response.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error ?? "Pagamenti non disponibili al momento.");
  }

  if (loading || !user) return <div className="p-10 text-center text-ink-soft">Caricamento...</div>;

  if (user.plan !== "PRO") {
    return (
      <DashboardShell user={user}>
        <div className="mx-auto max-w-xl py-16 text-center">
          <h1 className="font-display text-2xl">Il tuo centro di controllo</h1>
          <p className="mx-auto mt-3 max-w-prose text-ink-soft">
            Monitora performance, traffico, metriche, visibilita' e stato tecnico dei tuoi siti da un unico
            ambiente.
          </p>
          <div className="mt-6 text-left">
            <UpgradeCard
              title="Gestionale"
              description="Disponibile con il piano Pro: Web Analytics, Search Console, Metrics e Observability in un'unica vista, oltre a storico completo delle analisi."
              onCtaClick={handleUpgrade}
            />
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell user={user}>
      <h1 className="font-display text-2xl">Gestionale</h1>
      <p className="mt-1 text-sm text-ink-soft">DigitalCheck — powered by Imperium Digital</p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap px-4 py-2 text-sm ${
                tab === t.key ? "border-b-2 border-accent font-medium text-ink" : "text-ink-soft"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab !== "overview" && sites.length > 0 && (
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.url}
              </option>
            ))}
          </select>
        )}
      </div>

      {tab === "overview" && (
        <div className="mt-6 space-y-8">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <MetricCard label="Siti monitorati" value={overview?.totalSites ?? "—"} />
            <MetricCard label="Punteggio medio" value={overview?.avgScore ?? "—"} />
            <MetricCard label="Alert recenti" value={overview?.alerts.length ?? 0} />
          </div>

          <section>
            <h2 className="font-display text-lg">Ultime analisi</h2>
            {!overview || overview.recentScans.length === 0 ? (
              <div className="mt-3">
                <EmptyState title="Nessuna analisi recente" description="Esegui una nuova analisi per popolare questa vista." />
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {overview.recentScans.map((s) => (
                  <Link
                    key={s.siteId}
                    href={`/dashboard/site/${s.siteId}`}
                    className="flex items-center justify-between rounded-lg border border-line bg-white p-4 hover:border-accent"
                  >
                    <span className="text-sm">{s.url}</span>
                    <span className="text-sm text-ink-soft">
                      {s.score != null ? `Score ${s.score}` : "—"} ·{" "}
                      {s.date ? new Date(s.date).toLocaleDateString("it-IT") : ""}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-display text-lg">Problemi ricorrenti</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Conteggio reale dei problemi identici rilevati sull&apos;ultima analisi di piu' siti — non un'inferenza.
            </p>
            {!overview || overview.recurringIssues.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">Nessun problema ricorrente tra i tuoi siti al momento.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {overview.recurringIssues.map((i) => (
                  <li key={i.title} className="rounded-lg border border-line bg-white p-3 text-sm">
                    <span className="font-medium">{i.title}</span>{" "}
                    <span className="text-ink-soft">— presente su {i.siteCount} siti</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="font-display text-lg">Alert</h2>
            {!overview || overview.alerts.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">Nessun alert al momento.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {overview.alerts.map((a) => (
                  <li key={a.id} className="rounded-lg border border-line bg-white p-3 text-sm text-ink-soft">
                    {a.message}
                    <span className="ml-2 text-xs">{new Date(a.createdAt).toLocaleDateString("it-IT")}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === "analytics" && (
        <div className="mt-6 max-w-xl rounded-lg border border-line bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Web Analytics</h2>
            <StatusBadge status={connections?.analytics.connected ? "connected" : "not_connected"} />
          </div>
          {connections?.analytics.connected ? (
            <p className="mt-3 text-sm text-ink-soft">
              Utenti, sessioni, sorgenti di traffico e pagine principali comparirebbero qui.
            </p>
          ) : (
            <>
              <p className="mt-3 text-sm text-ink-soft">Google Analytics non collegato.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Collega il tuo account per visualizzare utenti, sessioni, sorgenti di traffico e pagine principali.
                Richiede la configurazione di un provider OAuth Google (vedi{" "}
                <code className="rounded bg-line px-1 py-0.5 text-xs">GOOGLE_ANALYTICS_CLIENT_ID</code>).
              </p>
              <button
                disabled
                title="Richiede configurazione OAuth lato server"
                className="mt-4 cursor-not-allowed rounded-md border border-line px-4 py-2 text-sm text-ink-soft opacity-70"
              >
                Collega Google Analytics
              </button>
            </>
          )}
        </div>
      )}

      {tab === "search-console" && (
        <div className="mt-6 max-w-xl rounded-lg border border-line bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Search Console</h2>
            <StatusBadge status={connections?.searchConsole.connected ? "connected" : "not_connected"} />
          </div>
          {connections?.searchConsole.connected ? (
            <p className="mt-3 text-sm text-ink-soft">Click, impression, CTR e posizione media comparirebbero qui.</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-ink-soft">Google Search Console non collegata.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Collega il tuo account per visualizzare click, impression, CTR e posizione media delle query. Richiede
                la configurazione di un provider OAuth Google (vedi{" "}
                <code className="rounded bg-line px-1 py-0.5 text-xs">GOOGLE_SEARCH_CONSOLE_CLIENT_ID</code>).
              </p>
              <button
                disabled
                title="Richiede configurazione OAuth lato server"
                className="mt-4 cursor-not-allowed rounded-md border border-line px-4 py-2 text-sm text-ink-soft opacity-70"
              >
                Collega Search Console
              </button>
            </>
          )}
        </div>
      )}

      {tab === "metrics" && (
        <div className="mt-6 space-y-6">
          <div className="rounded-lg border border-line bg-white p-6">
            <h2 className="font-display text-lg">Andamento Digital Score</h2>
            <div className="mt-4">
              <ScoreTrendChart
                points={(metrics?.points ?? []).map((p) => ({ date: p.date, score: p.overallScore }))}
                label="Digital Score"
              />
            </div>
            {metrics?.trendNote && <p className="mt-3 text-sm text-ink-soft">{metrics.trendNote}</p>}
          </div>

          {metrics && metrics.points.length > 0 && (
            <div className="rounded-lg border border-line bg-white p-6">
              <h2 className="font-display text-lg">Ultimi punteggi per categoria</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {Object.entries(metrics.points[metrics.points.length - 1]?.categoryScores ?? {}).map(([key, score]) => (
                  <MetricCard key={key} label={CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS] ?? key} value={score} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "observability" && (
        <div className="mt-6 max-w-xl rounded-lg border border-line bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Observability</h2>
            <StatusBadge status={connections?.monitoring.configured ? "connected" : "not_configured"} />
          </div>
          {connections?.monitoring.configured ? (
            <p className="mt-3 text-sm text-ink-soft">Uptime, tempi di risposta ed errori comparirebbero qui.</p>
          ) : (
            <>
              <p className="mt-3 text-sm text-ink-soft">Monitoring non ancora configurato.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Una volta collegato un provider di uptime monitoring, qui compariranno disponibilita', tempi di
                risposta, errori e incidenti in tempo reale.
              </p>
              <button
                disabled
                title="Richiede la configurazione di un provider di monitoring"
                className="mt-4 cursor-not-allowed rounded-md border border-line px-4 py-2 text-sm text-ink-soft opacity-70"
              >
                Configura monitoring
              </button>
            </>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
