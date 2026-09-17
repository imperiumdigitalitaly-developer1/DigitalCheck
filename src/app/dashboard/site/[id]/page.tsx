"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { DigitalCheckReport } from "@/types";
import { ReportView } from "@/components/ReportView";

interface ScanHistoryItem {
  id: string;
  status: string;
  overallScore: number | null;
  pagesCrawled: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  issueCount: number;
  highSeverityCount: number;
}

interface SiteDetail {
  id: string;
  url: string;
  businessType: string;
  goal: string;
  monitoringEnabled: boolean;
  scanFrequencyDays: number;
  nextScanAt: string | null;
  scans: ScanHistoryItem[];
}

const PRO_FEATURES = [
  "Analisi complete e report dettagliato",
  "Monitoraggio automatico periodico",
  "Storico e confronto dei punteggi nel tempo",
  "Report PDF scaricabili e condivisibili",
  "Analisi AI avanzata dei contenuti",
  "Assistente AI: testi e correzioni pronti da incollare",
  "Richiedi il nostro intervento diretto per implementarle",
  "Fino a 10 siti monitorati, 100 scansioni al mese",
];

export default function SiteDetailPage({ params }: { params: { id: string } }) {
  const [site, setSite] = useState<SiteDetail | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState(false);

  const [question, setQuestion] = useState("");
  const [askingAdvisor, setAskingAdvisor] = useState(false);
  const [advisorHistory, setAdvisorHistory] = useState<{ question: string; answer: string }[]>([]);
  const [advisorError, setAdvisorError] = useState<string | null>(null);

  const [helpMessage, setHelpMessage] = useState("");
  const [sendingHelp, setSendingHelp] = useState(false);
  const [helpSent, setHelpSent] = useState<string | null>(null);

  const [openReportScanId, setOpenReportScanId] = useState<string | null>(null);
  const [reportsByScan, setReportsByScan] = useState<Record<string, DigitalCheckReport>>({});
  const [loadingReport, setLoadingReport] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [siteRes, meRes] = await Promise.all([
      fetch(`/api/sites/${params.id}`),
      fetch("/api/auth/me"),
    ]);
    if (siteRes.ok) setSite(await siteRes.json());
    else setError("Sito non trovato.");
    if (meRes.ok) {
      const me = await meRes.json();
      const pro = me.user?.plan === "PRO";
      setIsPro(pro);
      if (pro) {
        const historyRes = await fetch(`/api/sites/${params.id}/advisor`);
        if (historyRes.ok) {
          const { messages } = await historyRes.json();
          const turns: { question: string; answer: string }[] = [];
          for (let i = 0; i < messages.length - 1; i += 2) {
            if (messages[i]?.role === "user" && messages[i + 1]?.role === "assistant") {
              turns.push({ question: messages[i].text, answer: messages[i + 1].text });
            }
          }
          setAdvisorHistory(turns);
        }
      }
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleScanNow() {
    setScanning(true);
    await fetch(`/api/sites/${params.id}/scan`, { method: "POST" });
    await load();
    setScanning(false);
  }

  async function handleToggleMonitoring() {
    if (!site) return;
    const response = await fetch(`/api/sites/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monitoringEnabled: !site.monitoringEnabled }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 403) {
        setUpgradePrompt(true);
      } else {
        setError(data.error ?? "Non e' stato possibile aggiornare il monitoraggio.");
      }
      return;
    }
    await load();
  }

  async function handleShare(scanId: string) {
    const response = await fetch(`/api/reports/${scanId}/share`, { method: "POST" });
    const data = await response.json();
    if (response.ok) setShareUrl(data.pdfUrl);
  }

  async function handleUpgrade() {
    const response = await fetch("/api/billing/checkout", { method: "POST" });
    const data = await response.json();
    if (data.url) window.location.href = data.url;
    else alert(data.error ?? "Pagamenti non disponibili al momento.");
  }

  async function handleToggleReport(scanId: string) {
    if (openReportScanId === scanId) {
      setOpenReportScanId(null);
      return;
    }
    setOpenReportScanId(scanId);
    if (!reportsByScan[scanId]) {
      setLoadingReport(scanId);
      const response = await fetch(`/api/sites/${params.id}/scan/${scanId}/report`);
      const data = await response.json();
      if (response.ok) {
        setReportsByScan((prev) => ({ ...prev, [scanId]: data.report }));
      }
      setLoadingReport(null);
    }
  }

  async function handleAskAdvisor(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setAskingAdvisor(true);
    setAdvisorError(null);
    const response = await fetch(`/api/sites/${params.id}/advisor`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 403) setUpgradePrompt(true);
      else setAdvisorError(data.error ?? "Non e' stato possibile ottenere una risposta.");
    } else {
      setAdvisorHistory((h) => [...h, { question, answer: data.answer }]);
      setQuestion("");
    }
    setAskingAdvisor(false);
  }

  async function handleRequestHelp(e: React.FormEvent) {
    e.preventDefault();
    if (!helpMessage.trim()) return;
    setSendingHelp(true);
    setHelpSent(null);
    const response = await fetch(`/api/sites/${params.id}/request-help`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: helpMessage }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 403) setUpgradePrompt(true);
      else setHelpSent(data.error ?? "Non e' stato possibile inviare la richiesta.");
    } else {
      setHelpSent("Richiesta inviata: ti contatteremo a breve.");
      setHelpMessage("");
    }
    setSendingHelp(false);
  }

  if (loading) return <div className="p-10 text-center text-ink-soft">Caricamento...</div>;
  if (error || !site) return <div className="p-10 text-center text-severity-high">{error}</div>;

  const latestCompleted = site.scans.find((s) => s.status === "COMPLETED");

  return (
    <main className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white px-6 py-4">
        <div className="mx-auto max-w-4xl">
          <Link href="/dashboard" className="text-sm text-ink-soft hover:text-ink">
            ← Torna alla dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl">{site.url}</h1>
        <p className="mt-1 text-ink-soft">
          {site.businessType} · {site.goal}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            onClick={handleScanNow}
            disabled={scanning}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:bg-accent-deep disabled:opacity-60"
          >
            {scanning ? "Scansione in corso..." : "Esegui nuova scansione"}
          </button>
          <button
            onClick={handleToggleMonitoring}
            className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent"
          >
            Monitoraggio: {site.monitoringEnabled ? "attivo" : "disattivo"}
          </button>
          {latestCompleted && (
            <>
              <a
                href={`/api/reports/${latestCompleted.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent"
              >
                Scarica PDF
              </a>
              <button
                onClick={() => handleShare(latestCompleted.id)}
                className="rounded-md border border-line px-4 py-2 text-sm hover:border-accent"
              >
                Condividi report
              </button>
            </>
          )}
        </div>

        {site.monitoringEnabled && site.nextScanAt && (
          <p className="mt-2 text-sm text-ink-soft">
            Prossima scansione automatica: {new Date(site.nextScanAt).toLocaleDateString("it-IT")}
          </p>
        )}
        {shareUrl && (
          <p className="mt-2 break-all text-sm text-ink-soft">
            Link pubblico: <a href={shareUrl} className="text-accent hover:underline">{shareUrl}</a>
          </p>
        )}

        {upgradePrompt && (
          <section className="mt-6 max-w-xl rounded-lg border border-accent bg-accent-soft/40 p-6">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-display text-xl">Passa al piano Pro</h3>
              <button
                onClick={() => setUpgradePrompt(false)}
                aria-label="Chiudi"
                className="text-ink-soft hover:text-ink"
              >
                ✕
              </button>
            </div>
            <p className="mt-2 text-sm text-ink-soft">
              Questa funzione fa parte del piano Pro, che sblocca tutto quello che serve per non limitarti a sapere
              cosa non va, ma sistemarlo davvero:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex gap-2">
                  <span className="text-accent">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              onClick={handleUpgrade}
              className="mt-5 w-full rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-paper hover:bg-accent-deep"
            >
              Passa a Pro — 6,99 €/mese
            </button>
          </section>
        )}

        <section className="mt-10">
          <h2 className="font-display text-xl">DigitalCheck AI Assistant</h2>
          {!isPro ? (
            <button
              onClick={() => setUpgradePrompt(true)}
              className="mt-3 rounded-lg border border-dashed border-line bg-white px-5 py-4 text-left text-sm text-ink-soft hover:border-accent"
            >
              Disponibile con il piano Pro: chiedi consigli specifici e ricevi testi pronti da incollare
              (title, meta description, correzioni). Tocca per saperne di piu'.
            </button>
          ) : (
            <div className="mt-3 rounded-lg border border-line bg-white p-5">
              {advisorHistory.length === 0 && (
                <p className="text-sm text-ink-soft">
                  Fai una domanda sul sito — es. &quot;scrivimi una meta description migliore&quot; o
                  &quot;come miglioro il punteggio SEO?&quot;.
                </p>
              )}
              <div className="space-y-4">
                {advisorHistory.map((turn, i) => (
                  <div key={i}>
                    <p className="text-sm font-medium">{turn.question}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink-soft">{turn.answer}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAskAdvisor} className="mt-4 flex gap-2">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Scrivi la tua domanda..."
                  className="flex-1 rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  disabled={askingAdvisor}
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-paper hover:bg-accent-deep disabled:opacity-60"
                >
                  {askingAdvisor ? "..." : "Chiedi"}
                </button>
              </form>
              {advisorError && <p className="mt-2 text-sm text-severity-high">{advisorError}</p>}
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl">Richiedi il nostro intervento</h2>
          {!isPro ? (
            <button
              onClick={() => setUpgradePrompt(true)}
              className="mt-3 rounded-lg border border-dashed border-line bg-white px-5 py-4 text-left text-sm text-ink-soft hover:border-accent"
            >
              Disponibile con il piano Pro: se non vuoi implementare tu le correzioni, chiedi direttamente al
              nostro team di farlo per te.
            </button>
          ) : (
            <form onSubmit={handleRequestHelp} className="mt-3 rounded-lg border border-line bg-white p-5">
              <textarea
                value={helpMessage}
                onChange={(e) => setHelpMessage(e.target.value)}
                placeholder="Descrivi cosa vorresti che sistemassimo sul sito..."
                rows={3}
                className="w-full rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                type="submit"
                disabled={sendingHelp}
                className="mt-3 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper disabled:opacity-60"
              >
                {sendingHelp ? "Invio..." : "Invia richiesta"}
              </button>
              {helpSent && <p className="mt-2 text-sm text-ink-soft">{helpSent}</p>}
            </form>
          )}
        </section>

        <h2 className="mt-10 font-display text-xl">Storico scansioni</h2>
        <div className="mt-4 space-y-2">
          {site.scans.length === 0 && <p className="text-ink-soft">Nessuna scansione ancora eseguita.</p>}
          {site.scans.map((scan) => (
            <div key={scan.id} className="rounded-lg border border-line bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-ink-soft">{new Date(scan.startedAt).toLocaleString("it-IT")}</p>
                  <p className="text-sm">
                    {scan.status === "COMPLETED"
                      ? `Score ${scan.overallScore} · ${scan.issueCount} problemi (${scan.highSeverityCount} alta priorita')`
                      : scan.status === "FAILED"
                        ? `Fallito: ${scan.errorMessage}`
                        : scan.status}
                  </p>
                </div>
                {scan.status === "COMPLETED" && (
                  <div className="flex shrink-0 items-center gap-3">
                    <button
                      onClick={() => handleToggleReport(scan.id)}
                      className="text-sm text-accent hover:underline"
                    >
                      {openReportScanId === scan.id ? "Nascondi report" : "Vedi report"}
                    </button>
                    <a
                      href={`/api/reports/${scan.id}/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-accent hover:underline"
                    >
                      PDF
                    </a>
                  </div>
                )}
              </div>
              {openReportScanId === scan.id && (
                <div className="mt-5 border-t border-line pt-5">
                  {loadingReport === scan.id && <p className="text-sm text-ink-soft">Caricamento report...</p>}
                  {(() => {
                    const scanReport = reportsByScan[scan.id];
                    return scanReport ? <ReportView report={scanReport} onUpgrade={handleUpgrade} /> : null;
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
