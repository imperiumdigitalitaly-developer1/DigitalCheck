import type { AiAnalysis, BusinessGoal, BusinessType, CrawlResult, SeoFacts } from "@/types";
import { buildAiInput, buildSystemPrompt, buildUserPrompt } from "./prompts";
import { parseAiAnalysis } from "./schema";
import { createHash } from "crypto";
import { callGemini, type GeminiPriority } from "./gemini-client";

export interface ContentAnalysisResult {
  analysis: AiAnalysis | null;
  unavailableReason?: string;
}

// Cache in-memory (per istanza) dell'analisi, con chiave = hash del prompt
// completo: se testo, titoli, segnali di contatto, tipo di attivita' e
// obiettivo sono identici l'input a Gemini e' identico e rifare la chiamata
// consumerebbe quota condivisa per lo stesso risultato. Basta che cambi
// qualcosa nel sito perche' la chiave cambi e l'analisi venga rifatta.
// Vengono cachati solo i successi, mai i fallimenti.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const analysisCache = new Map<string, { expiresAt: number; result: ContentAnalysisResult }>();
// Richieste identiche simultanee (es. lo stesso URL scansionato da due
// visitatori insieme) condividono la stessa chiamata in corso.
const inFlight = new Map<string, Promise<ContentAnalysisResult>>();

export async function runContentAnalysis(
  facts: SeoFacts,
  crawl: CrawlResult,
  businessType: BusinessType,
  goal: BusinessGoal,
  options: { priority?: GeminiPriority } = {}
): Promise<ContentAnalysisResult> {
  const payload = buildAiInput(facts, crawl, businessType, goal);
  const system = buildSystemPrompt();
  const user = buildUserPrompt(payload);

  const key = createHash("sha256").update(system).update("\u0000").update(user).digest("hex");
  const cached = analysisCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = analyzeUncached(system, user, options.priority).then((result) => {
    if (result.analysis) {
      if (analysisCache.size >= CACHE_MAX_ENTRIES) {
        const oldest = analysisCache.keys().next().value;
        if (oldest !== undefined) analysisCache.delete(oldest);
      }
      analysisCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, result });
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

async function analyzeUncached(
  system: string,
  user: string,
  priority: GeminiPriority | undefined
): Promise<ContentAnalysisResult> {
  const result = await callGemini(system, user, { timeoutMs: 20_000, priority });
  if (!result.text) {
    return {
      analysis: null,
      unavailableReason: `Analisi AI non disponibile: ${result.errorReason ?? "errore sconosciuto"}.`,
    };
  }

  const parsed = parseAiAnalysis(result.text);
  if (!parsed) {
    return {
      analysis: null,
      unavailableReason:
        "Analisi AI non disponibile: la risposta del modello non era conforme al formato atteso.",
    };
  }

  const analysis: AiAnalysis = {
    summary: parsed.summary,
    strengths: parsed.strengths,
    issues: parsed.issues,
    priorities: parsed.priorities,
    conversionAnalysis: parsed.conversion_analysis,
    contentAnalysis: parsed.content_analysis,
  };

  return { analysis };
}
