import type { CategoryKey } from "@/types";
import { scoreToStatus } from "./constants";
import type { AnalysisResult, AnalysisStatus, DataAvailability, Finding, Recommendation, SubScore } from "./types";

/** Media pesata dei sottopunteggi di una categoria (brief sezione 3: deterministico, riproducibile). */
export function combineSubScores(subScores: SubScore[]): number {
  const totalWeight = subScores.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = subScores.reduce((sum, s) => sum + s.score * s.weight, 0);
  return Math.max(0, Math.min(100, Math.round(weighted / totalWeight)));
}

/**
 * dataAvailability della categoria = il piu' limitato tra i suoi
 * sottopunteggi (brief sezione 34): se anche un solo sottopunteggio e'
 * "unavailable", la categoria nel suo complesso non e' "verified".
 */
export function combineDataAvailability(subScores: SubScore[]): DataAvailability {
  const order: DataAvailability[] = ["unavailable", "partial", "not_applicable", "verified"];
  let worst: DataAvailability = "verified";
  for (const s of subScores) {
    if (order.indexOf(s.dataAvailability) < order.indexOf(worst)) worst = s.dataAvailability;
  }
  return worst;
}

export function sub(
  key: string,
  label: string,
  score: number,
  weight: number,
  dataAvailability: DataAvailability = "verified"
): SubScore {
  return { key, label, score: Math.max(0, Math.min(100, Math.round(score))), weight, dataAvailability };
}

export function finding(
  category: CategoryKey,
  title: string,
  severity: Finding["severity"],
  explanation: string,
  impact: string,
  evidence?: string
): Finding {
  return { category, title, severity, explanation, impact, evidence };
}

export function recommendation(
  category: CategoryKey,
  title: string,
  severity: Recommendation["severity"],
  explanation: string,
  impact: string,
  action: string,
  evidence?: string
): Recommendation {
  return { category, title, severity, explanation, impact, action, evidence };
}

/**
 * Assembla l'AnalysisResult finale di una categoria a partire dai suoi
 * sottopunteggi + findings/recommendations gia' raccolti dal motore
 * specifico. Punto unico che calcola score/status/dataAvailability, cosi'
 * ogni motore di categoria non deve ripetere la stessa logica (brief
 * sezione 46: centralizzare).
 */
export function buildAnalysisResult(input: {
  category: CategoryKey;
  subScores: SubScore[];
  strengths: string[];
  findings: Finding[];
  recommendations: Recommendation[];
  metrics: AnalysisResult["metrics"];
  shortSummary: string;
  notes?: string;
}): AnalysisResult {
  const score = combineSubScores(input.subScores);
  const status: AnalysisStatus = scoreToStatus(score);
  return {
    category: input.category,
    score,
    status,
    dataAvailability: combineDataAvailability(input.subScores),
    subScores: input.subScores,
    metrics: input.metrics,
    strengths: input.strengths,
    findings: input.findings,
    recommendations: input.recommendations,
    shortSummary: input.shortSummary,
    notes: input.notes,
  };
}

/** Testo visibile grezzo, per euristiche di lunghezza/duplicazione contenuti (Content, SEO content-signals). */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
