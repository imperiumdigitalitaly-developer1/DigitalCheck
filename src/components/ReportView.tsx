"use client";

import { useEffect, useState } from "react";
import type { DigitalCheckReport } from "@/types";
import { ScoreCircle } from "./ScoreCircle";
import { ConsultationModal } from "./ConsultationModal";
import { UpgradeCard } from "./UpgradeCard";
import { CategoryScoreCard } from "./CategoryScoreCard";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import { getPlanFeatures } from "@/lib/billing/plan-config";
import { scoreToStatus } from "@/lib/analysis/constants";

// Dashboard = panoramica executive (brief audit, sezioni 14/15/39): SOLO
// nome categoria, punteggio, stato e una breve sintesi generale per
// ciascuna delle 8 categorie (7 + GEO). Elenco problemi, raccomandazioni,
// priorita', cross-analysis e action plan sono un'esclusiva del PDF Pro
// (brief sezione 17: "Il PDF Pro deve essere il vero prodotto premium").
// Questa vista e' identica per Free e Pro: cambia solo cosa il PDF
// scaricabile contiene.
// Dopo un errore di quota (429) il pulsante resta disabilitato per questo
// tempo: ritentare subito peggiorerebbe solo il rate limit condiviso da
// tutte le funzioni AI (brief "gestione errori AI", punto A).
const QUOTA_COOLDOWN_MS = 30_000;

export function ReportView({
  report,
  plan,
  onUpgrade,
  siteId,
  scanId,
}: {
  report: DigitalCheckReport;
  plan: "FREE" | "PRO";
  onUpgrade?: () => void;
  /** Se presenti insieme, e l'analisi AI dell'audit era fallita, mostra il pulsante "Genera approfondimento AI". */
  siteId?: string;
  scanId?: string;
}) {
  const [showConsultation, setShowConsultation] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerated, setRegenerated] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const fullReportsEnabled = getPlanFeatures(plan).fullReports;
  const aiEnabled = getPlanFeatures(plan).ai;

  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const cooldownActive = cooldownUntil != null && now < cooldownUntil;
  const cooldownSecondsLeft = cooldownActive ? Math.ceil((cooldownUntil! - now) / 1000) : 0;
  const canRegenerate = aiEnabled && siteId && scanId && !report.aiInsightsAvailable;

  async function handleRegenerateAi() {
    if (!siteId || !scanId || regenerating || cooldownActive) return;
    setRegenerating(true);
    setRegenerateError(null);
    try {
      const response = await fetch(`/api/sites/${siteId}/scan/${scanId}/regenerate-ai`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setRegenerateError(data.error ?? "Non e' stato possibile generare l'approfondimento AI.");
        if (data.code === "quota") setCooldownUntil(Date.now() + QUOTA_COOLDOWN_MS);
      } else {
        setRegenerated(true);
      }
    } catch {
      setRegenerateError("Connessione non riuscita. Riprova.");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <div className="space-y-10">
      {/* DigitalCheck Score + sintesi esecutiva */}
      <section className="flex flex-col items-center gap-6 rounded-[14px] border border-line bg-white p-8 text-center sm:flex-row sm:text-left">
        <ScoreCircle score={report.overallScore} />
        <div className="max-w-prose">
          <p className="text-sm uppercase tracking-wide text-ink-soft">
            {report.requestedUrl} · {report.pagesAnalyzed} pagine analizzate
          </p>
          <h2 className="mt-1 font-display text-2xl">DigitalCheck Score</h2>
          <p className="mt-2 text-ink-soft">{report.businessImpactSummary}</p>
        </div>
      </section>

      {canRegenerate && (
        <section className="rounded-[14px] border border-dashed border-line bg-white p-6 text-center">
          {regenerated ? (
            <p className="text-sm text-ink-soft">
              Approfondimento AI generato: sara' incluso nel PDF e nell'assistente da ora in poi.
            </p>
          ) : (
            <>
              <h3 className="font-display text-lg">Approfondimento AI non incluso in questa versione del report</h3>
              <p className="mx-auto mt-1 max-w-prose text-sm text-ink-soft">
                Le indicazioni si basano sui controlli tecnici automatici. Puoi generare ora l'interpretazione AI
                dell'audit: verra' salvata e inclusa nel PDF.
              </p>
              <button
                onClick={handleRegenerateAi}
                disabled={regenerating || cooldownActive}
                className="mt-4 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-deep disabled:opacity-60"
              >
                {cooldownActive
                  ? `Riprova tra ${cooldownSecondsLeft}s`
                  : regenerating
                    ? "Generazione in corso..."
                    : "Genera approfondimento AI"}
              </button>
              {regenerateError && (
                <p className="mx-auto mt-3 max-w-prose rounded-md border border-line bg-paper px-3 py-2 text-sm text-ink-soft" role="status">
                  {regenerateError}
                </p>
              )}
            </>
          )}
        </section>
      )}

      {/* Panoramica per categoria: 7 categorie + GEO, solo score/stato/sintesi */}
      <section>
        <h3 className="font-display text-xl">Panoramica per categoria</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {report.analyses.map((a) => (
            <CategoryScoreCard
              key={a.category}
              label={CATEGORY_LABELS[a.category]}
              score={a.score}
              status={a.status}
              summary={a.shortSummary}
            />
          ))}
          {report.geo && (
            <CategoryScoreCard
              label="GEO"
              score={report.geo.overallScore}
              status={scoreToStatus(report.geo.overallScore)}
              summary={report.geoShortSummary ?? ""}
            />
          )}
        </div>
      </section>

      {/* Il dettaglio (problemi, gravita', raccomandazioni, action plan)
          vive solo nel PDF Pro — mai in questa vista (brief sezione 15). */}
      <section className="rounded-lg border border-dashed border-line bg-white p-6 text-center">
        {fullReportsEnabled ? (
          <>
            <h3 className="font-display text-lg">Vuoi il dettaglio completo?</h3>
            <p className="mx-auto mt-1 max-w-prose text-sm text-ink-soft">
              Scarica il report PDF: contiene metodologia, sottopunteggi, problemi rilevati con gravita' e impatto,
              raccomandazioni, cross-analysis tra le categorie e un piano d'azione prioritizzato.
            </p>
          </>
        ) : (
          <UpgradeCard
            title="Sblocca l'audit professionale completo"
            description="Con DigitalCheck Pro ottieni il PDF completo: metodologia, sottopunteggi, problemi rilevati con gravita' e impatto, raccomandazioni, cross-analysis e piano d'azione per ogni categoria."
            onCtaClick={onUpgrade}
          />
        )}
      </section>

      {/* CTA consulenza */}
      <section className="rounded-lg bg-ink p-8 text-center text-paper">
        <h3 className="font-display text-2xl">Vuoi migliorare il tuo sito?</h3>
        <p className="mx-auto mt-2 max-w-prose text-paper/80">
          Richiedi una consulenza per un piano d'azione su misura per {report.requestedUrl}.
        </p>
        <button
          onClick={() => setShowConsultation(true)}
          className="mt-5 inline-block rounded-md bg-accent px-6 py-3 font-medium text-paper transition-colors hover:bg-accent-deep"
        >
          Richiedi una consulenza
        </button>
      </section>

      {showConsultation && (
        <ConsultationModal onClose={() => setShowConsultation(false)} prefillUrl={report.requestedUrl} />
      )}
    </div>
  );
}
