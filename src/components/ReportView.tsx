"use client";

import { useState } from "react";
import type { DigitalCheckReport, IssueSeverity } from "@/types";
import { ScoreCircle } from "./ScoreCircle";
import { ConsultationModal } from "./ConsultationModal";
import { UpgradeCard } from "./UpgradeCard";
import { GeoReportSection } from "./GeoReportSection";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import { getPlanFeatures } from "@/lib/billing/plan-config";

const SEVERITY_LABELS: Record<IssueSeverity, { label: string; className: string }> = {
  high: { label: "Priorita' alta", className: "bg-severity-high/10 text-severity-high border-severity-high/30" },
  medium: { label: "Priorita' media", className: "bg-severity-medium/10 text-severity-medium border-severity-medium/30" },
  low: { label: "Priorita' bassa", className: "bg-severity-low/10 text-severity-low border-severity-low/30" },
};

export function ReportView({
  report,
  plan,
  onUpgrade,
}: {
  report: DigitalCheckReport;
  plan: "FREE" | "PRO";
  onUpgrade?: () => void;
}) {
  const [showConsultation, setShowConsultation] = useState(false);
  // Fonte unica per capire se l'utente ha diritto all'Assistente AI: mai
  // dedotto dal contenuto del report (che puo' mancare anche per un Pro,
  // es. generazione AI fallita per quello scan specifico) — vedi
  // src/lib/billing/plan-config.ts.
  const aiEnabled = getPlanFeatures(plan).ai;
  const bySeverity = { high: [] as typeof report.issues, medium: [] as typeof report.issues, low: [] as typeof report.issues };
  for (const issue of report.issues) bySeverity[issue.severity].push(issue);

  return (
    <div className="space-y-12">
      {/* Digital Score + Executive Summary */}
      <section className="flex flex-col items-center gap-6 rounded-lg border border-line bg-white p-8 text-center sm:flex-row sm:text-left">
        <ScoreCircle score={report.overallScore} />
        <div className="max-w-prose">
          <p className="text-sm uppercase tracking-wide text-ink-soft">
            {report.requestedUrl} · {report.pagesAnalyzed} pagine analizzate
          </p>
          <h2 className="mt-1 font-display text-2xl">Riepilogo</h2>
          <p className="mt-2 text-ink-soft">{report.businessImpactSummary}</p>
        </div>
      </section>

      {/* Category scores */}
      <section>
        <h3 className="font-display text-xl">Punteggi per categoria</h3>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {report.categoryScores.map((c) => (
            <div key={c.category} className="rounded-lg border border-line bg-white p-4">
              <p className="text-sm text-ink-soft">{CATEGORY_LABELS[c.category]}</p>
              <p className="font-display text-2xl">{c.score}</p>
              {!c.verified && (
                <p className="mt-1 text-xs text-ink-soft">Stima, non verificato</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Strengths */}
      {report.strengths.length > 0 && (
        <section>
          <h3 className="font-display text-xl">Punti di forza</h3>
          <ul className="mt-3 space-y-2">
            {report.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-ink-soft">
                <span aria-hidden className="text-accent">+</span>
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Issues */}
      <section>
        <h3 className="font-display text-xl">Problemi individuati</h3>
        <div className="mt-4 space-y-3">
          {(["high", "medium", "low"] as const).flatMap((severity) =>
            bySeverity[severity].map((issue, i) => (
              <article key={`${severity}-${i}`} className="rounded-lg border border-line bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${SEVERITY_LABELS[severity].className}`}>
                    {SEVERITY_LABELS[severity].label}
                  </span>
                  <h4 className="font-medium">{issue.title}</h4>
                </div>
                <p className="mt-2 text-ink-soft">{issue.description}</p>
                <p className="mt-2 text-sm text-ink-soft">
                  <span className="font-medium text-ink">Perche' conta: </span>
                  {issue.whyItMatters}
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-medium">Cosa fare: </span>
                  {issue.recommendation}
                </p>
              </article>
            ))
          )}
        </div>
        {report.isFreePreview && (report.hiddenIssueCount ?? 0) > 0 && (
          <div className="mt-4">
            <UpgradeCard
              title="Ci sono altre criticita'"
              description={`Abbiamo individuato altri ${report.hiddenIssueCount} problem${
                report.hiddenIssueCount === 1 ? "a" : "i"
              }. Passa a Pro per visualizzare l'analisi completa, con spiegazioni e azioni per ciascuno.`}
              onCtaClick={onUpgrade}
              compact
            />
          </div>
        )}
      </section>

      {/* Recommended actions */}
      {report.recommendedActions.length > 0 && (
        <section>
          <h3 className="font-display text-xl">Azioni consigliate</h3>
          <ol className="mt-3 space-y-2">
            {report.recommendedActions.map((a, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-display text-accent">{i + 1}</span>
                <span className="text-ink-soft">{a}</span>
              </li>
            ))}
          </ol>
          {report.isFreePreview && (report.hiddenRecommendationCount ?? 0) > 0 && (
            <p className="mt-3 text-sm text-ink-soft">
              + altre {report.hiddenRecommendationCount} azioni consigliate disponibili con il piano Pro.
            </p>
          )}
        </section>
      )}

      {/* AI Analysis */}
      <section>
        <h3 className="font-display text-xl">Analisi AI</h3>
        {!aiEnabled ? (
          <div className="mt-4">
            <UpgradeCard
              title="Assistente AI"
              description="Analizza i risultati, interpreta le criticita' e ricevi indicazioni operative personalizzate, distinguendo sempre il dato osservato dall'interpretazione e dal suggerimento."
              onCtaClick={onUpgrade}
            />
          </div>
        ) : report.aiAnalysis ? (
          <div className="mt-4 space-y-4 rounded-lg border border-line bg-white p-6">
            {report.aiAnalysis.conversionAnalysis && (
              <div>
                <p className="text-sm font-medium text-ink">Interpretazione — conversione</p>
                <p className="mt-1 text-sm text-ink-soft">{report.aiAnalysis.conversionAnalysis}</p>
              </div>
            )}
            {report.aiAnalysis.contentAnalysis && (
              <div>
                <p className="text-sm font-medium text-ink">Interpretazione — contenuti</p>
                <p className="mt-1 text-sm text-ink-soft">{report.aiAnalysis.contentAnalysis}</p>
              </div>
            )}
            {report.aiAnalysis.priorities.length > 0 && (
              <div>
                <p className="text-sm font-medium text-ink">Suggerimenti prioritari</p>
                <ol className="mt-1 space-y-1">
                  {report.aiAnalysis.priorities.map((p, i) => (
                    <li key={i} className="text-sm text-ink-soft">
                      {i + 1}. {p}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ) : (
          // Piano abilitato ma questa scansione non ha prodotto un'analisi
          // AI (errore tecnico/timeout): mai il paywall in questo caso, il
          // motivo e' gia' elencato in "Cosa non e' stato possibile verificare".
          <p className="mt-4 text-sm text-ink-soft">
            Analisi AI non disponibile per questa scansione. Riprova con una nuova analisi del sito.
          </p>
        )}
      </section>

      {/* GEO — Generative Engine Optimization */}
      {report.geo && <GeoReportSection geo={report.geo} aiEnabled={aiEnabled} onUpgrade={onUpgrade} />}

      {/* Unverifiable */}
      {report.unverifiable.length > 0 && (
        <section className="rounded-lg border border-line bg-accent-soft/40 p-5 text-sm text-ink-soft">
          <p className="font-medium text-ink">Cosa non e' stato possibile verificare</p>
          <ul className="mt-2 space-y-1">
            {report.unverifiable.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ul>
        </section>
      )}

      {/* CTA */}
      <section className="rounded-lg bg-ink p-8 text-center text-paper">
        <h3 className="font-display text-2xl">Vuoi migliorare il tuo sito?</h3>
        <p className="mx-auto mt-2 max-w-prose text-paper/80">
          DigitalCheck ha individuato {report.issues.length} punti di miglioramento per{" "}
          {report.requestedUrl}.
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
