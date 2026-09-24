import type { DigitalCheckReport } from "@/types";
import type { GeoReport } from "@/lib/geo/geo-types";
import { FREE_PREVIEW_STRENGTH_COUNT } from "./plan-config";

/**
 * Riduce un report completo alla versione mostrabile al piano Free (brief
 * audit, sezioni 16/30/31): score, stato e una breve sintesi per ciascuna
 * delle 8 categorie restano visibili — mai problemi, raccomandazioni,
 * cross-analysis o action plan, che sono il vero prodotto premium del PDF
 * Pro. Applicato SEMPRE lato server prima di rispondere a un utente Free
 * (qui e nella route del PDF), non solo nascosto in UI: un utente Free non
 * deve poter leggere il contenuto Pro nemmeno ispezionando la risposta di
 * rete (brief sezione 31: "non e' sufficiente nascondere il pulsante").
 */
export function toFreeReport(report: DigitalCheckReport): DigitalCheckReport {
  return {
    ...report,
    // Sistema di audit multi-categoria: score/status/sottopunteggi/metriche
    // restano (sono la "panoramica generale" consentita anche al Free),
    // findings e recommendations — il vero audit dettagliato — no.
    analyses: report.analyses.map((a) => ({ ...a, findings: [], recommendations: [] })),
    crossAnalysis: [], // sezione esclusiva del PDF Pro (brief sezione 26)
    actionPlan: [], // sezione esclusiva del PDF Pro (brief sezione 27)
    // Campi legacy: nessun dettaglio, solo sintesi (mantengono il
    // comportamento gia' in produzione per i consumer non ancora migrati).
    issues: [],
    recommendedActions: [],
    strengths: report.strengths.slice(0, FREE_PREVIEW_STRENGTH_COUNT),
    aiAnalysis: null,
    geo: report.geo ? toFreeGeoReport(report.geo) : null,
    isFreePreview: true,
    hiddenIssueCount: report.actionPlan.length,
    hiddenRecommendationCount: report.actionPlan.length,
  };
}

function toFreeGeoReport(geo: GeoReport): GeoReport {
  return {
    ...geo,
    issues: [], // dettaglio Pro-only, come le altre 7 categorie (brief sezione 16)
    strengths: geo.strengths.slice(0, 1),
    informationCompleteness: [],
    answerabilityQueries: [],
    aiSummary: null,
    aiComparisonNote: null,
    isFreePreview: true,
    hiddenIssueCount: geo.issues.length,
  };
}
