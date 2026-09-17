import type { DigitalCheckReport } from "@/types";
import { FREE_PREVIEW_ACTION_COUNT, FREE_PREVIEW_ISSUE_COUNT, FREE_PREVIEW_STRENGTH_COUNT } from "./plan-config";

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

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
    isFreePreview: true,
    hiddenIssueCount,
    hiddenRecommendationCount,
  };
}
