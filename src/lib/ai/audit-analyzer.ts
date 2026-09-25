import { createHash } from "crypto";
import type { BusinessGoal, BusinessType, CategoryKey } from "@/types";
import type { GeoIssue } from "@/lib/geo/geo-types";
import type { AnalysisResult } from "@/lib/analysis/types";
import { buildAuditAiInput, buildAuditSystemPrompt, buildAuditUserPrompt } from "./audit-prompts";
import { parseAuditAiAnalysis } from "./audit-schema";
import { callGemini } from "./gemini-client";

export interface AuditAiResult {
  executiveSummary: string | null;
  categorySummaries: Partial<Record<CategoryKey | "geo", string>>;
  mainStrengths: string[];
  mainWeaknesses: string[];
  strategicRecommendations: string[];
  quickWins: string[];
  strategicImprovements: string[];
  finalAssessment: string | null;
  crossAnalysisNotes: Record<string, string>;
  unavailableReason?: string;
}

// Stessa strategia di cache/in-flight-dedup di geo-analyzer.ts e
// content-analyzer.ts: chiave = hash dei dati GIA' CALCOLATI dalle 8
// categorie, cosi' un'analisi identica non richiama Gemini inutilmente
// (brief audit sezione 32).
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map<string, { expiresAt: number; result: AuditAiResult }>();
const inFlight = new Map<string, Promise<AuditAiResult>>();

export async function runAuditAiAnalysis(
  analyses: AnalysisResult[],
  geoScore: number | null,
  geoIssues: GeoIssue[],
  masterScore: number,
  crossAnalysisPairLabels: string[],
  businessType: BusinessType,
  goal: BusinessGoal
): Promise<AuditAiResult> {
  const payload = buildAuditAiInput(analyses, geoScore, geoIssues, masterScore, crossAnalysisPairLabels, businessType, goal);
  const system = buildAuditSystemPrompt();
  const user = buildAuditUserPrompt(payload);

  const key = createHash("sha256").update(system).update("\u0000").update(user).digest("hex");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = analyzeUncached(system, user).then((result) => {
    if (result.executiveSummary) {
      if (cache.size >= CACHE_MAX_ENTRIES) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result });
    }
    return result;
  });
  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

async function analyzeUncached(system: string, user: string): Promise<AuditAiResult> {
  const result = await callGemini(system, user, { timeoutMs: 25_000, json: true });
  if (!result.text) {
    console.error(`[audit-analyzer] chiamata AI fallita: ${result.errorReason ?? "errore sconosciuto"}`);
    return {
      executiveSummary: null,
      categorySummaries: {},
      mainStrengths: [],
      mainWeaknesses: [],
      strategicRecommendations: [],
      quickWins: [],
      strategicImprovements: [],
      finalAssessment: null,
      crossAnalysisNotes: {},
      unavailableReason: `Interpretazione AI dell'audit non disponibile: ${result.errorReason ?? "errore sconosciuto"}.`,
    };
  }

  const parsed = parseAuditAiAnalysis(result.text);
  if (!parsed.ok) {
    console.error(`[audit-analyzer] risposta AI non utilizzabile: ${parsed.reason}`);
    return {
      executiveSummary: null,
      categorySummaries: {},
      mainStrengths: [],
      mainWeaknesses: [],
      strategicRecommendations: [],
      quickWins: [],
      strategicImprovements: [],
      finalAssessment: null,
      crossAnalysisNotes: {},
      unavailableReason: "Interpretazione AI dell'audit non disponibile: la risposta del modello non era conforme al formato atteso.",
    };
  }

  return {
    executiveSummary: parsed.data.executive_summary,
    categorySummaries: parsed.data.category_summaries as Partial<Record<CategoryKey | "geo", string>>,
    mainStrengths: parsed.data.main_strengths,
    mainWeaknesses: parsed.data.main_weaknesses,
    strategicRecommendations: parsed.data.strategic_recommendations,
    quickWins: parsed.data.quick_wins,
    strategicImprovements: parsed.data.strategic_improvements,
    finalAssessment: parsed.data.final_assessment || null,
    crossAnalysisNotes: parsed.data.cross_analysis_notes,
  };
}
