import { createHash } from "crypto";
import type { BusinessGoal, BusinessType } from "@/types";
import type { GeoScoringOutput } from "@/lib/geo/geo-scoring";
import { buildGeoAiInput, buildGeoSystemPrompt, buildGeoUserPrompt } from "./geo-prompts";
import { parseGeoAiAnalysis } from "./geo-schema";
import { callGemini } from "./gemini-client";

export interface GeoAiResult {
  summary: string | null;
  priorities: string[];
  comparisonNote: string | null;
  unavailableReason?: string;
}

// Stessa strategia di cache di content-analyzer.ts: chiave = hash dei dati
// GEO/SEO gia' calcolati, cosi' un'analisi identica non richiama Gemini
// inutilmente (brief GEO sezione 25: evitare richieste duplicate).
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map<string, { expiresAt: number; result: GeoAiResult }>();
const inFlight = new Map<string, Promise<GeoAiResult>>();

export async function runGeoAiAnalysis(
  geo: GeoScoringOutput,
  seoOverallScore: number,
  seoTopIssueTitles: string[],
  businessType: BusinessType,
  goal: BusinessGoal
): Promise<GeoAiResult> {
  const payload = buildGeoAiInput(geo, seoOverallScore, seoTopIssueTitles, businessType, goal);
  const system = buildGeoSystemPrompt();
  const user = buildGeoUserPrompt(payload);

  const key = createHash("sha256").update(system).update("\u0000").update(user).digest("hex");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = analyzeUncached(system, user).then((result) => {
    if (result.summary) {
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

async function analyzeUncached(system: string, user: string): Promise<GeoAiResult> {
  const result = await callGemini(system, user, { timeoutMs: 20_000, json: true });
  if (!result.text) {
    console.error(`[geo-analyzer] chiamata AI fallita: ${result.errorReason ?? "errore sconosciuto"}`);
    return {
      summary: null,
      priorities: [],
      comparisonNote: null,
      unavailableReason: `Interpretazione AI del GEO non disponibile: ${result.errorReason ?? "errore sconosciuto"}.`,
    };
  }

  const parsed = parseGeoAiAnalysis(result.text);
  if (!parsed.ok) {
    console.error(`[geo-analyzer] risposta AI non utilizzabile: ${parsed.reason}`);
    return {
      summary: null,
      priorities: [],
      comparisonNote: null,
      unavailableReason: "Interpretazione AI del GEO non disponibile: la risposta del modello non era conforme al formato atteso.",
    };
  }

  return {
    summary: parsed.data.summary,
    priorities: parsed.data.priorities,
    comparisonNote: parsed.data.comparison_note,
  };
}
