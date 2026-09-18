import { z } from "zod";

// Schema dell'output atteso dal modello AI (sezione 25 del brief).
// Ogni risposta del provider viene validata contro questo schema prima
// di essere usata: se non e' conforme, il report la tratta come
// "analisi AI non disponibile" invece di propagare dati inaffidabili.
//
// I limiti di lunghezza non scartano l'analisi: un summary troppo lungo
// viene troncato e gli elementi in eccesso di issues/priorities vengono
// ignorati, cosi' il resto dell'analisi (valido) non va perso.
const SUMMARY_MAX_CHARS = 2000;
const STRENGTHS_MAX = 10;
const ISSUES_MAX = 15;
const PRIORITIES_MAX = 10;

export const aiAnalysisSchema = z.object({
  summary: z
    .string()
    .min(1)
    .transform((s) => s.slice(0, SUMMARY_MAX_CHARS)),
  strengths: z.array(z.string()).transform((a) => a.slice(0, STRENGTHS_MAX)),
  issues: z
    .array(
      z.object({
        title: z.string(),
        category: z.enum(["technical", "ux", "seo", "content", "conversion"]),
        severity: z.enum(["high", "medium", "low"]),
        explanation: z.string(),
        recommendation: z.string(),
      })
    )
    .transform((a) => a.slice(0, ISSUES_MAX)),
  priorities: z.array(z.string()).transform((a) => a.slice(0, PRIORITIES_MAX)),
  conversion_analysis: z.string(),
  content_analysis: z.string(),
});

export type AiAnalysisRaw = z.infer<typeof aiAnalysisSchema>;

export type ParseAiAnalysisResult =
  | { ok: true; data: AiAnalysisRaw }
  | { ok: false; reason: string };

/**
 * Anche con responseMimeType JSON il modello puo' avvolgere l'oggetto in
 * un blocco Markdown (```json ... ```) o aggiungere testo attorno: se c'e'
 * un blocco recintato si usa il suo contenuto, altrimenti il testo intero.
 */
function stripMarkdownFence(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced?.[1] ?? raw).trim();
}

export function parseAiAnalysis(rawJson: string): ParseAiAnalysisResult {
  let candidate: unknown;
  try {
    candidate = JSON.parse(stripMarkdownFence(rawJson));
  } catch (err) {
    return {
      ok: false,
      reason: `JSON non valido (${err instanceof Error ? err.message : "errore di parsing"})`,
    };
  }
  const result = aiAnalysisSchema.safeParse(candidate);
  if (!result.success) {
    const details = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(radice)"}: ${i.message}`)
      .join("; ");
    return { ok: false, reason: `JSON non conforme allo schema (${details})` };
  }
  return { ok: true, data: result.data };
}
