"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { DashboardShell } from "@/components/DashboardShell";
import { MetricCard } from "@/components/MetricCard";
import { EmptyState } from "@/components/EmptyState";
import { UpgradeCard } from "@/components/UpgradeCard";
import { StatusBadge, MonitorStatusBadge } from "@/components/StatusBadge";
import { ScoreTrendChart } from "@/components/ScoreTrendChart";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { SearchConsolePanel } from "@/components/SearchConsolePanel";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import { GEO_CATEGORY_LABELS } from "@/lib/geo/geo-labels";

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

// "observability" resta un valore valido di Tab (route/stato/API invariati,
// vedi src/lib/integrations/uptimerobot.ts) ma e' temporaneamente escluso
// da questa lista: nasconde la tab dalla navigazione senza toccare
// l'integrazione sottostante. Per riattivarla basta rimettere la riga qui
// sotto — vedi anche il redirect nell'effect piu' in basso che riporta a
// "overview" chi arriva su ?tab=observability da un link salvato.
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "analytics", label: "Web Analytics" },
  { key: "search-console", label: "Search Console" },
  { key: "metrics", label: "Metrics" },
];

interface OverviewData {
  totalSites: number;
  avgScore: number | null;
  recentScans: { siteId: string; url: string; score: number | null; date: string | null }[];
  recurringIssues: { title: string; siteCount: number }[];
  alerts: { id: string; type: string; message: string; createdAt: string; read: boolean }[];
}

interface MetricsData {
  points: {
    scanId: string;
    date: string;
    overallScore: number | null;
    categoryScores: Record<string, number>;
    geoOverallScore: number | null;
    geoCategoryScores: Record<string, number> | null;
  }[];
  trendNote: string | null;
  geoTrendNote: string | null;
}

interface ConnectionsData {
  analytics: { connected: boolean; configured: boolean };
  searchConsole: { connected: boolean; configured: boolean };
  monitoring: { configured: boolean };
}

interface MonitorIncident {
  kind: "down" | "up" | "started" | "paused" | "other";
  at: string;
  durationSeconds: number | null;
}

interface MonitorSnapshot {
  monitorId: string;
  url: string;
  status: "up" | "down" | "paused" | "pending" | "unknown";
  uptimeRatio30d: number | null;
  lastResponseTimeMs: number | null;
  incidents: MonitorIncident[];
}

interface ObservabilityData {
  providerConfigured: boolean;
  monitor: MonitorSnapshot | null;
  error: string | null;
}

const INCIDENT_LABEL: Record<MonitorIncident["kind"], string> = {
  down: "Sito irraggiungibile",
  up: "Tornato online",
  started: "Monitoraggio avviato",
  paused: "Monitoraggio in pausa",
  other: "Evento",
};

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_site: "Seleziona un sito prima di collegare l'integrazione.",
  site_not_found: "Sito non trovato o non di tua proprieta'.",
  plan_required: "Questa integrazione richiede il piano Pro.",
  not_configured: "Integrazione non ancora configurata lato server.",
  denied: "Autorizzazione annullata su Google.",
  invalid_request: "Richiesta OAuth non valida.",
  invalid_state: "Sessione di autorizzazione scaduta o non valida: riprova.",
  exchange_failed: "Google non ha confermato l'autorizzazione: riprova.",
};

export default function GestionalePage() {
  return (
    <Suspense fallback={null}>
      <GestionaleView />
    </Suspense>
  );
}

function GestionaleView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<MeUser | null>(null);
  const [sites, setSites] = useState<SiteListItem[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [oauthNotice, setOauthNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [connections, setConnections] = useState<ConnectionsData | null>(null);
  const [observability, setObservability] = useState<ObservabilityData | null>(null);
  const [observabilityLoading, setObservabilityLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetch("/api/auth/me").then((r) => r.json()), fetch("/api/sites").then((r) => (r.ok ? r.json() : []))]).then(
      ([me, siteList]: [{ user: MeUser | null }, SiteListItem[]]) => {
        setUser(me.user);
        setSites(siteList);
        const querySiteId = searchParams.get("siteId");
        const initialSiteId = siteList.find((s) => s.id === querySiteId)?.id ?? siteList[0]?.id;
        if (initialSiteId) setSelectedSiteId(initialSiteId);
        setLoading(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Consuma una sola volta i parametri di ritorno dal redirect OAuth
  // (tab/siteId gia' catturati nello state sopra, oauth_error/connected solo
  // per il messaggio), poi ripulisce l'URL cosi' un refresh non lo ripete.
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    // "observability" e' temporaneamente nascosta (vedi TABS sopra): un
    // link salvato con ?tab=observability riporta a Overview invece di
    // aprire una tab non piu' raggiungibile dalla navigazione.
    const validTabs: Tab[] = ["overview", "analytics", "search-console", "metrics"];
    if (tabParam && (validTabs as string[]).includes(tabParam)) {
      setTab(tabParam as Tab);
    } else if (tabParam === "observability") {
      setTab("overview");
    }
    const oauthError = searchParams.get("oauth_error");
    const connected = searchParams.get("connected");
    if (oauthError) {
      setOauthNotice({
        kind: "error",
        message: OAUTH_ERROR_MESSAGES[oauthError] ?? "Si e' verificato un errore durante il collegamento.",
      });
    } else if (connected === "1") {
      setOauthNotice({ kind: "success", message: "Integrazione collegata con successo." });
    }
    if (tabParam || oauthError || connected) {
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const loadObservability = useCallback(async (siteId: string) => {
    if (!siteId) return;
    setObservabilityLoading(true);
    setProvisionError(null);
    try {
      const res = await fetch(`/api/gestionale/observability?siteId=${siteId}`);
      if (res.ok) setObservability(await res.json());
    } finally {
      setObservabilityLoading(false);
    }
  }, []);

  const handleProvisionMonitor = useCallback(async () => {
    if (!selectedSiteId) return;
    setProvisioning(true);
    setProvisionError(null);
    try {
      const res = await fetch("/api/gestionale/observability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId: selectedSiteId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProvisionError(data.error ?? "Impossibile creare il monitor.");
        return;
      }
      await loadObservability(selectedSiteId);
    } finally {
      setProvisioning(false);
    }
  }, [selectedSiteId, loadObservability]);

  useEffect(() => {
    if (user?.plan !== "PRO") return;
    if (tab === "overview") loadOverview();
    if (tab === "metrics") loadMetrics(selectedSiteId);
    if (tab === "analytics" || tab === "search-console") loadConnections(selectedSiteId);
    if (tab === "observability") loadObservability(selectedSiteId);
  }, [tab, selectedSiteId, user, loadOverview, loadMetrics, loadConnections, loadObservability]);

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
            Monitora performance, traffico, metriche, visibilita&apos; e stato tecnico dei tuoi siti da un unico
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

      {oauthNotice && (
        <div
          className={`mt-4 rounded-lg border p-3 text-sm ${
            oauthNotice.kind === "success"
              ? "border-score-strong/30 bg-score-strong/10 text-score-strong"
              : "border-severity-high/30 bg-severity-high/10 text-severity-high"
          }`}
        >
          {oauthNotice.message}
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="scroll-shadow-x flex min-w-0 max-w-full gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`min-h-[44px] shrink-0 whitespace-nowrap px-4 py-2 text-sm ${
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
            aria-label="Sito"
            className="min-h-[44px] w-full min-w-0 rounded-md border border-line px-3 py-2 text-base outline-none focus:border-accent md:w-auto md:max-w-sm"
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
                    className="flex min-h-[44px] items-center justify-between gap-3 rounded-[14px] border border-line bg-white p-4 hover:border-accent"
                  >
                    <span className="min-w-0 break-words text-sm">{s.url}</span>
                    <span className="shrink-0 text-right text-sm text-ink-soft">
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
              Conteggio reale dei problemi identici rilevati sull&apos;ultima analisi di piu&apos; siti — non un&apos;inferenza.
            </p>
            {!overview || overview.recurringIssues.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">Nessun problema ricorrente tra i tuoi siti al momento.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {overview.recurringIssues.map((i) => (
                  <li key={i.title} className="rounded-[14px] border border-line bg-white p-3 text-sm">
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
                  <li key={a.id} className="rounded-[14px] border border-line bg-white p-3 text-sm text-ink-soft">
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
        <div className="mt-6 rounded-[14px] border border-line bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Web Analytics</h2>
            <StatusBadge status={connections?.analytics.connected ? "connected" : "not_connected"} />
          </div>
          {connections?.analytics.connected ? (
            <AnalyticsPanel
              siteId={selectedSiteId}
              connectHref={`/api/gestionale/connections/analytics/connect?siteId=${selectedSiteId}`}
            />
          ) : connections?.analytics.configured ? (
            <>
              <p className="mt-3 text-sm text-ink-soft">Google Analytics non collegato per questo sito.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Collega l&apos;account Google del cliente per visualizzare utenti, sessioni, sorgenti di traffico e
                pagine principali. La connessione riguarda solo questo sito.
              </p>
              <a
                href={`/api/gestionale/connections/analytics/connect?siteId=${selectedSiteId}`}
                className="tap-target mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm text-paper hover:bg-accent-deep"
              >
                Collega Google Analytics
              </a>
            </>
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
        <div className="mt-6 rounded-[14px] border border-line bg-white p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Search Console</h2>
            <StatusBadge status={connections?.searchConsole.connected ? "connected" : "not_connected"} />
          </div>
          {connections?.searchConsole.connected ? (
            <SearchConsolePanel
              siteId={selectedSiteId}
              connectHref={`/api/gestionale/connections/search-console/connect?siteId=${selectedSiteId}`}
            />
          ) : connections?.searchConsole.configured ? (
            <>
              <p className="mt-3 text-sm text-ink-soft">Google Search Console non collegata per questo sito.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Collega l&apos;account Google del cliente per visualizzare click, impression, CTR e posizione media
                delle query. La connessione riguarda solo questo sito.
              </p>
              <a
                href={`/api/gestionale/connections/search-console/connect?siteId=${selectedSiteId}`}
                className="tap-target mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm text-paper hover:bg-accent-deep"
              >
                Collega Search Console
              </a>
            </>
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
          <div className="rounded-[14px] border border-line bg-white p-4 sm:p-6">
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
            <div className="rounded-[14px] border border-line bg-white p-4 sm:p-6">
              <h2 className="font-display text-lg">Ultimi punteggi per categoria (SEO)</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                {Object.entries(metrics.points[metrics.points.length - 1]?.categoryScores ?? {}).map(([key, score]) => (
                  <MetricCard key={key} label={CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS] ?? key} value={score} />
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[14px] border border-line bg-white p-4 sm:p-6">
            <h2 className="font-display text-lg">Andamento GEO Score</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Predisposizione del sito a essere compreso e citato da motori di ricerca generativi e AI answer engine.
            </p>
            <div className="mt-4">
              <ScoreTrendChart
                points={(metrics?.points ?? []).map((p) => ({ date: p.date, score: p.geoOverallScore }))}
                label="GEO Score"
              />
            </div>
            {metrics?.geoTrendNote && <p className="mt-3 text-sm text-ink-soft">{metrics.geoTrendNote}</p>}
          </div>

          {metrics && metrics.points.some((p) => p.geoCategoryScores) && (
            <div className="rounded-[14px] border border-line bg-white p-4 sm:p-6">
              <h2 className="font-display text-lg">Ultimi punteggi per categoria (GEO)</h2>
              <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                {Object.entries(
                  [...metrics.points].reverse().find((p) => p.geoCategoryScores)?.geoCategoryScores ?? {}
                ).map(([key, score]) => (
                  <MetricCard key={key} label={GEO_CATEGORY_LABELS[key as keyof typeof GEO_CATEGORY_LABELS] ?? key} value={score} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "observability" && (
        <div className="mt-6 max-w-xl rounded-[14px] border border-line bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">Observability</h2>
            {observability?.monitor ? (
              <MonitorStatusBadge status={observability.monitor.status} />
            ) : (
              <StatusBadge status={observability?.providerConfigured ? "not_connected" : "not_configured"} />
            )}
          </div>

          {observabilityLoading && !observability && (
            <p className="mt-3 text-sm text-ink-soft">Caricamento...</p>
          )}

          {observability?.monitor ? (
            <>
              <p className="mt-1 text-xs text-ink-soft">Dati da UptimeRobot — aggiornati al massimo ogni 5 minuti.</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <MetricCard
                  label="Uptime (30 giorni)"
                  value={observability.monitor.uptimeRatio30d != null ? `${observability.monitor.uptimeRatio30d.toFixed(2)}%` : "—"}
                />
                <MetricCard
                  label="Tempo di risposta (ultima rilevazione)"
                  value={observability.monitor.lastResponseTimeMs != null ? `${observability.monitor.lastResponseTimeMs} ms` : "—"}
                />
              </div>

              <h3 className="mt-6 text-sm font-medium">Eventi recenti</h3>
              {observability.monitor.incidents.length === 0 ? (
                <p className="mt-2 text-sm text-ink-soft">Nessun evento registrato di recente.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {observability.monitor.incidents.map((incident, i) => (
                    <li key={i} className="rounded-[14px] border border-line p-3 text-sm">
                      <span className="font-medium">{INCIDENT_LABEL[incident.kind]}</span>{" "}
                      <span className="text-ink-soft">
                        — {new Date(incident.at).toLocaleString("it-IT")}
                        {incident.durationSeconds != null && incident.kind === "down"
                          ? ` · durata ${Math.round(incident.durationSeconds / 60)} min`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : observability?.error ? (
            <>
              <p className="mt-3 text-sm text-ink-soft">
                Il monitor e&apos; collegato, ma non e&apos; stato possibile leggerne lo stato in questo momento.
              </p>
              <p className="mt-1 text-sm text-severity-high">{observability.error}</p>
              <button
                onClick={() => loadObservability(selectedSiteId)}
                className="mt-4 rounded-md border border-line px-4 py-2 text-sm hover:border-accent"
              >
                Riprova
              </button>
            </>
          ) : observability && !observabilityLoading ? (
            <>
              <p className="mt-3 text-sm text-ink-soft">Monitoring non ancora configurato per questo sito.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Una volta collegato, qui compariranno disponibilita&apos;, tempi di risposta ed eventuali interruzioni
                rilevate realmente da UptimeRobot.
              </p>
              {observability.providerConfigured ? (
                <>
                  <button
                    onClick={handleProvisionMonitor}
                    disabled={provisioning}
                    className="mt-4 rounded-md bg-accent px-4 py-2 text-sm text-paper hover:bg-accent-deep disabled:opacity-60"
                  >
                    {provisioning ? "Configurazione in corso..." : "Configura monitoring"}
                  </button>
                  {provisionError && <p className="mt-2 text-sm text-severity-high">{provisionError}</p>}
                </>
              ) : (
                <button
                  disabled
                  title="Richiede la configurazione di UPTIMEROBOT_API_KEY lato server"
                  className="mt-4 cursor-not-allowed rounded-md border border-line px-4 py-2 text-sm text-ink-soft opacity-70"
                >
                  Configura monitoring
                </button>
              )}
            </>
          ) : null}
        </div>
      )}
    </DashboardShell>
  );
}
