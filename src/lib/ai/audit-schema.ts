import { z } from "zod";

const SUMMARY_MAX_CHARS = 1500;
const LIST_MAX = 6;
const CATEGORY_SUMMARY_MAX_CHARS = 300;

export const auditAiAnalysisSchema = z.object({
  executive_summary: z.string().min(1).transform((s) => s.slice(0, SUMMARY_MAX_CHARS)),
  category_summaries: z
    .record(z.string(), z.string().transform((s) => s.slice(0, CATEGORY_SUMMARY_MAX_CHARS)))
    .default({}),
  main_strengths: z.array(z.string()).transform((a) => a.slice(0, LIST_MAX)),
  main_weaknesses: z.array(z.string()).transform((a) => a.slice(0, LIST_MAX)),
  strategic_recommendations: z.array(z.string()).transform((a) => a.slice(0, LIST_MAX)),
  // Redesign PDF (brief sezione 19): distinzione tra interventi rapidi a
  // basso sforzo e interventi piu' strutturali — entrambi derivati SOLO
  // dai problemi gia' rilevati, mai da un "effort" stimato senza base dati.
  quick_wins: z.array(z.string()).transform((a) => a.slice(0, LIST_MAX)).default([]),
  strategic_improvements: z.array(z.string()).transform((a) => a.slice(0, LIST_MAX)).default([]),
  final_assessment: z.string().transform((s) => s.slice(0, SUMMARY_MAX_CHARS)).default(""),
  cross_analysis_notes: z.record(z.string(), z.string()).default({}),
});

export type AuditAiAnalysisRaw = z.infer<typeof auditAiAnalysisSchema>;

export type ParseAuditAiAnalysisResult =
  | { ok: true; data: AuditAiAnalysisRaw }
  | { ok: false; reason: string };

function stripMarkdownFence(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced?.[1] ?? raw).trim();
}

export function parseAuditAiAnalysis(rawJson: string): ParseAuditAiAnalysisResult {
  let candidate: unknown;
  try {
    candidate = JSON.parse(stripMarkdownFence(rawJson));
  } catch (err) {
    return { ok: false, reason: `JSON non valido (${err instanceof Error ? err.message : "errore di parsing"})` };
  }
  const result = auditAiAnalysisSchema.safeParse(candidate);
  if (!result.success) {
    const details = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(radice)"}: ${i.message}`)
      .join("; ");
    return { ok: false, reason: `JSON non conforme allo schema (${details})` };
  }
  return { ok: true, data: result.data };
}
