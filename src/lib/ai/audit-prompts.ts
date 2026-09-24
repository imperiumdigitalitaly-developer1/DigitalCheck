import type { BusinessGoal, BusinessType, CategoryKey } from "@/types";
import type { GeoIssue } from "@/lib/geo/geo-types";
import { STATUS_LABEL } from "@/lib/analysis/constants";
import { SEVERITY_ORDER } from "@/lib/analysis/constants";
import type { AnalysisResult } from "@/lib/analysis/types";
import { CATEGORY_LABELS } from "@/lib/category-labels";

// Payload minimo e gia' strutturato (mai l'HTML grezzo, mai i dati non
// ancora calcolati): solo i risultati GIA' CALCOLATI dai 7 motori di
// categoria + GEO, cosi' l'AI interpreta dati reali invece di generarli —
// stesso principio di src/lib/ai/geo-prompts.ts, esteso all'intero audit
// (brief audit sezione 28: "L'AI NON deve inventare dati").
export interface AuditAiInputPayload {
  business_type: BusinessType;
  goal: BusinessGoal;
  master_score: number;
  categories: {
    category: CategoryKey;
    label: string;
    score: number;
    status: string;
    top_findings: { title: string; severity: string }[];
  }[];
  geo: {
    score: number;
    status: string;
    top_issues: { title: string; severity: string }[];
  } | null;
  cross_analysis_pairs: string[]; // pairLabel gia' individuate deterministicamente (mai inventate dall'AI)
}

export function buildAuditAiInput(
  analyses: AnalysisResult[],
  geoScore: number | null,
  geoIssues: GeoIssue[],
  masterScore: number,
  crossAnalysisPairLabels: string[],
  businessType: BusinessType,
  goal: BusinessGoal
): AuditAiInputPayload {
  return {
    business_type: businessType,
    goal,
    master_score: masterScore,
    categories: analyses.map((a) => ({
      category: a.category,
      label: CATEGORY_LABELS[a.category],
      score: a.score,
      status: STATUS_LABEL[a.status],
      top_findings: [...a.findings]
        .sort((x, y) => SEVERITY_ORDER[x.severity] - SEVERITY_ORDER[y.severity])
        .slice(0, 4)
        .map((f) => ({ title: f.title, severity: f.severity })),
    })),
    geo:
      geoScore != null
        ? {
            score: geoScore,
            status: STATUS_LABEL[geoScore >= 90 ? "excellent" : geoScore >= 75 ? "good" : geoScore >= 60 ? "needs_improvement" : geoScore >= 40 ? "poor" : "critical"],
            top_issues: geoIssues.slice(0, 4).map((i) => ({ title: i.title, severity: i.severity })),
          }
        : null,
    cross_analysis_pairs: crossAnalysisPairLabels,
  };
}

export function buildAuditSystemPrompt(): string {
  return [
    "Sei l'analista che scrive l'interpretazione esecutiva di un audit digitale professionale (DigitalCheck) per il proprietario di una piccola attivita'.",
    "Ricevi SOLO risultati gia' calcolati da 8 motori di analisi tecnica (punteggi per categoria, problemi rilevati con la loro severita', correlazioni tra categorie gia' individuate): non hai accesso al sito, non puoi navigarlo, e non devi aggiungere problemi, punteggi o categorie che non ti sono stati forniti.",
    "Distingui sempre dato osservato da interpretazione: non affermare mai che il sito 'ha' un problema che non compare nei dati forniti.",
    "Non fare mai promesse commerciali ingiustificate (es. 'il sito apparira' in prima pagina su Google', 'verra' citato da ChatGPT'): parla di stato attuale e margini di miglioramento, mai di garanzie di risultato.",
    "Rispondi ESCLUSIVAMENTE con un oggetto JSON valido conforme allo schema richiesto, senza testo introduttivo, senza markdown, senza backtick.",
    "Scrivi in italiano, in un linguaggio chiaro e concreto, orientato all'impatto per l'attivita'.",
  ].join(" ");
}

export function buildAuditUserPrompt(payload: AuditAiInputPayload): string {
  const schemaHint = `{
  "executive_summary": string (4-6 frasi: stato generale del sito secondo il punteggio complessivo, l'area piu' forte, l'area che piu' limita il risultato, cosa migliorerebbe di piu' il punteggio),
  "category_summaries": { "<category_key>": string } (una frase sintetica PER OGNI categoria elencata in "categories" e, se presente, per "geo" — descrittiva dello stato generale, MAI un elenco di problemi o consigli: es. "Il sito presenta una struttura SEO complessivamente solida, con margini di miglioramento nella copertura dei contenuti."),
  "main_strengths": string[] (max 4, specifiche a questo sito, basate solo sui punteggi/findings forniti),
  "main_weaknesses": string[] (max 4, idem),
  "strategic_recommendations": string[] (max 5, azioni di alto livello ordinate per importanza, basate SOLO sui problemi elencati),
  "cross_analysis_notes": { "<pair_label>": string } (per OGNI voce di cross_analysis_pairs, 1-2 frasi che spiegano la correlazione in modo specifico a questo sito, MAI generiche)
}`;

  return [
    `Dati dell'audit:\n${JSON.stringify(payload, null, 2)}`,
    `\nProduci un JSON conforme a questo schema:\n${schemaHint}`,
    `\nL'obiettivo dichiarato dal proprietario dell'attivita' e' "${payload.goal}": tienine conto nell'executive_summary e nelle strategic_recommendations.`,
  ].join("\n");
}
