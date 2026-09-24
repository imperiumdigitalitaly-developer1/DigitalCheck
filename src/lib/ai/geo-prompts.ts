import type { BusinessGoal, BusinessType } from "@/types";
import type { GeoScoringOutput } from "@/lib/geo/geo-scoring";

// Payload minimo e gia' strutturato (mai l'HTML grezzo): solo i risultati
// GIA' CALCOLATI dal motore di scoring GEO, cosi' l'AI interpreta dati
// reali invece di generarli (brief GEO sezione 36).
export interface GeoAiInputPayload {
  business_type: BusinessType;
  goal: BusinessGoal;
  geo_overall_score: number;
  geo_local_applicable: boolean;
  geo_category_scores: { category: string; score: number; applicable: boolean }[];
  geo_top_issues: { category: string; title: string; severity: string }[];
  geo_strengths: string[];
  geo_information_gaps: string[]; // domande di information-completeness rimaste senza risposta
  geo_unanswered_queries: string[]; // query di answerability rimaste senza risposta
  seo_overall_score: number;
  seo_top_issues: string[];
}

export function buildGeoAiInput(
  geo: GeoScoringOutput,
  seoOverallScore: number,
  seoTopIssueTitles: string[],
  businessType: BusinessType,
  goal: BusinessGoal
): GeoAiInputPayload {
  return {
    business_type: businessType,
    goal,
    geo_overall_score: geo.overallScore,
    geo_local_applicable: geo.localApplicable,
    geo_category_scores: geo.categoryScores.map((c) => ({ category: c.category, score: c.score, applicable: c.applicable })),
    geo_top_issues: geo.issues.slice(0, 8).map((i) => ({ category: i.category, title: i.title, severity: i.severity })),
    geo_strengths: geo.strengths,
    geo_information_gaps: geo.informationCompleteness.filter((i) => i.status === "missing").map((i) => i.question),
    geo_unanswered_queries: geo.answerabilityQueries.filter((q) => !q.answered).map((q) => q.query),
    seo_overall_score: seoOverallScore,
    seo_top_issues: seoTopIssueTitles,
  };
}

export function buildGeoSystemPrompt(): string {
  return [
    "Sei un analista specializzato in GEO (Generative Engine Optimization): valuti quanto un sito e' predisposto a essere compreso, sintetizzato e usato come fonte da motori di ricerca generativi e AI answer engine (es. ChatGPT, Google AI Overviews, Perplexity).",
    "Ricevi SOLO risultati gia' calcolati da un motore di analisi tecnica (punteggi per categoria, problemi rilevati, domande senza risposta): non hai accesso al sito, non puoi navigarlo, e non devi aggiungere problemi, dati o caratteristiche che non ti sono stati forniti.",
    "IMPORTANTE — non fare mai promesse commerciali ingiustificate: non dire mai che il sito 'apparira'', 'verra' citato' o 'sara' indicizzato' da un sistema AI specifico. Parla sempre di readiness, predisposizione, comprensibilita' per sistemi automatici — mai di garanzie di visibilita' o citazione.",
    "Distingui sempre tra dato osservato (cosa e' stato rilevato) e interpretazione (cosa significa) — mai presentare una tua supposizione come un fatto rilevato dal motore di analisi.",
    "Rispondi ESCLUSIVAMENTE con un oggetto JSON valido conforme allo schema richiesto, senza testo introduttivo, senza markdown, senza backtick.",
    "Scrivi in italiano, in modo diretto e pratico.",
  ].join(" ");
}

export function buildGeoUserPrompt(payload: GeoAiInputPayload): string {
  const schemaHint = `{
  "summary": string (3-5 frasi: stato generale della predisposizione GEO del sito, il problema piu' rilevante, cosa migliorerebbe di piu' il punteggio),
  "priorities": string[] (max 5, azioni concrete ordinate per importanza, basate SOLO sui problemi elencati sotto),
  "comparison_note": string (1-3 frasi che confrontano in modo semplice il punteggio SEO e quello GEO forniti, spiegando in cosa differiscono concettualmente per QUESTO sito specifico — non una spiegazione generica di cosa siano SEO e GEO)
}`;

  return [
    `Dati dell'analisi GEO e SEO:\n${JSON.stringify(payload, null, 2)}`,
    `\nProduci un JSON conforme a questo schema:\n${schemaHint}`,
  ].join("\n");
}
