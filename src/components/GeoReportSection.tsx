import type { GeoReport } from "@/lib/geo/geo-types";
import { GEO_CATEGORY_LABELS, GEO_SEVERITY_LABELS } from "@/lib/geo/geo-labels";
import { geoScoreLabel } from "@/lib/geo/geo-weights";
import { ScoreCircle } from "./ScoreCircle";
import { UpgradeCard } from "./UpgradeCard";

const GEO_SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

/**
 * Sezione GEO del report — stessa gerarchia visiva e stessi componenti
 * della sezione SEO in ReportView (brief GEO sezione 31: "il GEO deve
 * sembrare parte nativa del prodotto"), non una pagina/UI separata.
 */
export function GeoReportSection({
  geo,
  aiEnabled,
  onUpgrade,
}: {
  geo: GeoReport;
  aiEnabled: boolean;
  onUpgrade?: () => void;
}) {
  const sortedIssues = [...geo.issues].sort((a, b) => GEO_SEVERITY_ORDER[a.severity] - GEO_SEVERITY_ORDER[b.severity]);

  return (
    <section className="space-y-8 border-t border-line pt-10">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-accent">Generative Engine Optimization</p>
        <h3 className="mt-1 font-display text-2xl">GEO</h3>
        <p className="mt-1 max-w-prose text-sm text-ink-soft">
          Analizza quanto il tuo sito e&apos; comprensibile, affidabile e utilizzabile dai motori di ricerca e dagli
          AI answer engine — non una garanzia di comparsa o citazione su un sistema specifico, ma una misura della
          sua predisposizione (readiness) a esserlo.
        </p>
      </div>

      {/* Score + status */}
      <div className="flex flex-col items-center gap-6 rounded-lg border border-line bg-white p-8 text-center sm:flex-row sm:text-left">
        <ScoreCircle score={geo.overallScore} />
        <div className="max-w-prose">
          <p className="text-sm font-medium text-ink">{geoScoreLabel(geo.overallScore)}</p>
          {geo.aiSummary ? (
            <p className="mt-2 text-ink-soft">{geo.aiSummary}</p>
          ) : (
            <p className="mt-2 text-ink-soft">
              Punteggio calcolato su {geo.categoryScores.filter((c) => c.applicable).length} dimensioni: accessibilita'
              per i sistemi AI, chiarezza semantica e dell&apos;entita', completezza delle informazioni,
              answerability, struttura del contenuto, segnali di fiducia e dati strutturati.
            </p>
          )}
        </div>
      </div>

      {/* SEO vs GEO comparison */}
      {geo.aiComparisonNote && (
        <div className="rounded-lg border border-accent/30 bg-accent-soft/30 p-5">
          <p className="text-sm font-medium text-ink">SEO vs GEO</p>
          <p className="mt-1 text-sm text-ink-soft">{geo.aiComparisonNote}</p>
        </div>
      )}

      {/* Category breakdown — trasparenza del punteggio (brief sezione 37) */}
      <div>
        <h4 className="font-display text-lg">Punteggi per categoria</h4>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {geo.categoryScores.map((c) => (
            <div key={c.category} className="rounded-lg border border-line bg-white p-4">
              <p className="text-sm text-ink-soft">{GEO_CATEGORY_LABELS[c.category]}</p>
              {c.applicable ? (
                <p className="font-display text-2xl">{c.score}</p>
              ) : (
                <p className="text-sm text-ink-soft">Non applicabile</p>
              )}
              {c.notes && <p className="mt-1 text-xs text-ink-soft">{c.notes}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Strengths */}
      {geo.strengths.length > 0 && (
        <div>
          <h4 className="font-display text-lg">Segnali positivi</h4>
          <ul className="mt-3 space-y-2">
            {geo.strengths.map((s, i) => (
              <li key={i} className="flex gap-2 text-ink-soft">
                <span aria-hidden className="text-accent">
                  +
                </span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Issues */}
      <div>
        <h4 className="font-display text-lg">Problemi rilevati</h4>
        <div className="mt-4 space-y-3">
          {sortedIssues.length === 0 && <p className="text-sm text-ink-soft">Nessun problema GEO rilevante individuato.</p>}
          {sortedIssues.map((issue, i) => (
            <article key={i} className="rounded-lg border border-line bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${GEO_SEVERITY_LABELS[issue.severity].className}`}>
                  {GEO_SEVERITY_LABELS[issue.severity].label}
                </span>
                <span className="text-xs uppercase tracking-wide text-ink-soft">{GEO_CATEGORY_LABELS[issue.category]}</span>
                <h5 className="w-full font-medium sm:w-auto">{issue.title}</h5>
              </div>
              <p className="mt-2 text-ink-soft">{issue.description}</p>
              <p className="mt-2 text-sm text-ink-soft">
                <span className="font-medium text-ink">Perche&apos; conta: </span>
                {issue.whyItMatters}
              </p>
              <p className="mt-2 text-sm">
                <span className="font-medium">Cosa fare: </span>
                {issue.recommendation}
              </p>
              {issue.example && (
                <p className="mt-2 text-sm text-ink-soft">
                  <span className="font-medium text-ink">Esempio: </span>
                  {issue.example}
                </p>
              )}
            </article>
          ))}
        </div>
        {geo.isFreePreview && (geo.hiddenIssueCount ?? 0) > 0 && (
          <div className="mt-4">
            <UpgradeCard
              title="Analisi GEO completa con Pro"
              description={`Abbiamo individuato altri ${geo.hiddenIssueCount} problem${
                geo.hiddenIssueCount === 1 ? "a" : "i"
              } di predisposizione GEO. Passa a Pro per l'analisi completa, con tutte le domande valutate e i suggerimenti AI.`}
              onCtaClick={onUpgrade}
              compact
            />
          </div>
        )}
      </div>

      {/* Answerability detail (Pro only — dati avanzati) */}
      {geo.answerabilityQueries.length > 0 && (
        <div>
          <h4 className="font-display text-lg">Answerability</h4>
          <p className="mt-1 text-sm text-ink-soft">
            Domande realistiche generate dal contenuto reale del sito, e se trovano una risposta rilevabile nel testo.
          </p>
          <ul className="mt-3 space-y-2">
            {geo.answerabilityQueries.map((q, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={q.answered ? "text-score-strong" : "text-severity-high"} aria-hidden>
                  {q.answered ? "✓" : "✕"}
                </span>
                <span className="text-ink-soft">
                  <span className="text-ink">{q.query}</span>
                  {q.evidence && <span> — {q.evidence}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Information completeness detail (Pro only) */}
      {geo.informationCompleteness.length > 0 && (
        <div>
          <h4 className="font-display text-lg">Completezza delle informazioni</h4>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {geo.informationCompleteness.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className={item.status === "answered" ? "text-score-strong" : "text-severity-high"} aria-hidden>
                  {item.status === "answered" ? "✓" : "✕"}
                </span>
                <span className="text-ink-soft">{item.question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!aiEnabled && (
        <UpgradeCard
          title="Interpretazione AI del GEO"
          description="Ricevi una sintesi in linguaggio semplice, le priorita' di intervento e il confronto dinamico tra SEO e GEO per questo sito specifico."
          onCtaClick={onUpgrade}
        />
      )}
    </section>
  );
}
