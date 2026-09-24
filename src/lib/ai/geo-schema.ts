import { z } from "zod";

const SUMMARY_MAX_CHARS = 1200;
const PRIORITIES_MAX = 5;
const COMPARISON_MAX_CHARS = 600;

export const geoAiAnalysisSchema = z.object({
  summary: z
    .string()
    .min(1)
    .transform((s) => s.slice(0, SUMMARY_MAX_CHARS)),
  priorities: z.array(z.string()).transform((a) => a.slice(0, PRIORITIES_MAX)),
  comparison_note: z
    .string()
    .transform((s) => s.slice(0, COMPARISON_MAX_CHARS)),
});

export type GeoAiAnalysisRaw = z.infer<typeof geoAiAnalysisSchema>;

export type ParseGeoAiAnalysisResult =
  | { ok: true; data: GeoAiAnalysisRaw }
  | { ok: false; reason: string };

function stripMarkdownFence(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return (fenced?.[1] ?? raw).trim();
}

export function parseGeoAiAnalysis(rawJson: string): ParseGeoAiAnalysisResult {
  let candidate: unknown;
  try {
    candidate = JSON.parse(stripMarkdownFence(rawJson));
  } catch (err) {
    return { ok: false, reason: `JSON non valido (${err instanceof Error ? err.message : "errore di parsing"})` };
  }
  const result = geoAiAnalysisSchema.safeParse(candidate);
  if (!result.success) {
    const details = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".") || "(radice)"}: ${i.message}`)
      .join("; ");
    return { ok: false, reason: `JSON non conforme allo schema (${details})` };
  }
  return { ok: true, data: result.data };
}
