import type { DigitalCheckReport } from "@/types";
import type { GeoReport } from "@/lib/geo/geo-types";
import { FREE_PREVIEW_ACTION_COUNT, FREE_PREVIEW_ISSUE_COUNT, FREE_PREVIEW_STRENGTH_COUNT } from "./plan-config";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
const GEO_SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

// Il GEO e' secondario rispetto alla SEO nell'anteprima Free (brief GEO
// sezione 21: "2-3 indicatori principali", "massimo 2-3 problemi
// sintetici") — leggermente piu' stretto della soglia SEO.
const FREE_GEO_ISSUE_COUNT = 2;

function toFreeGeoReport(geo: GeoReport): GeoReport {
  const sortedIssues = [...geo.issues].sort(
    (a, b) => GEO_SEVERITY_ORDER[a.severity] - GEO_SEVERITY_ORDER[b.severity]
  );
  const visibleIssues = sortedIssues.slice(0, FREE_GEO_ISSUE_COUNT);

  return {
    ...geo,
    issues: visibleIssues,
    strengths: geo.strengths.slice(0, 1),
    // "Dati avanzati" esplicitamente esclusi dal Free (brief GEO sezione
    // 21): l'elenco completo delle domande valutate resta una funzionalita'
    // Pro, i punteggi per categoria restano visibili (sono "punteggi
    // principali", non analisi approfondita — stessa logica di
    // toFreeReport per la SEO).
    informationCompleteness: [],
    answerabilityQueries: [],
    aiSummary: null,
    aiComparisonNote: null,
    isFreePreview: true,
    hiddenIssueCount: Math.max(0, geo.issues.length - visibleIssues.length),
  };
}

/**
 * Riduce un report completo alla versione mostrabile al piano Free
 * (brief, sezioni 3-6): punteggi e sintesi restano visibili per intero,
 * ma solo un piccolo assaggio di problemi/raccomandazioni, e nessuna
 * interpretazione AI approfondita. Va applicato SEMPRE lato server prima
 * di rispondere a un utente Free, non solo nascosto in UI (sezione 30).
 */
export function toFreeReport(report: DigitalCheckReport): DigitalCheckReport {
  const sortedIssues = [...report.issues].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
  const visibleIssues = sortedIssues.slice(0, FREE_PREVIEW_ISSUE_COUNT);
  const hiddenIssueCount = Math.max(0, report.issues.length - visibleIssues.length);

  const visibleActions = report.recommendedActions.slice(0, FREE_PREVIEW_ACTION_COUNT);
  const hiddenRecommendationCount = Math.max(0, report.recommendedActions.length - visibleActions.length);

  return {
    ...report,
    issues: visibleIssues,
    recommendedActions: visibleActions,
    strengths: report.strengths.slice(0, FREE_PREVIEW_STRENGTH_COUNT),
    // L'interpretazione AI completa (priorita', analisi conversione/contenuti)
    // e' una funzionalita' Pro: il riassunto tecnico resta, il dettaglio no.
    aiAnalysis: null,
    geo: report.geo ? toFreeGeoReport(report.geo) : null,
    isFreePreview: true,
    hiddenIssueCount,
    hiddenRecommendationCount,
  };
}
