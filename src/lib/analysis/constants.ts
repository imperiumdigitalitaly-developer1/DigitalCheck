import type { AnalysisStatus, Severity } from "./types";

// Soglie centralizzate (brief sezione 4), usate da TUTTE le 8 categorie
// nella presentazione unificata (dashboard executive + PDF Pro scorecard +
// PDF Free) — un solo posto, non ripetuto in ogni componente (brief
// sezione 46). Deliberatamente distinta da scoreLabel() (src/lib/scoring/
// weights.ts, 5 fasce ma soglie leggermente diverse, usata dal testo AI
// esistente) e da geoScoreLabel() (src/lib/geo/geo-weights.ts, inglese):
// questa e' la fascia "ufficiale" del nuovo sistema di audit.
export function scoreToStatus(score: number): AnalysisStatus {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "needs_improvement";
  if (score >= 40) return "poor";
  return "critical";
}

export const STATUS_LABEL: Record<AnalysisStatus, string> = {
  excellent: "Eccellente",
  good: "Buono",
  needs_improvement: "Da migliorare",
  poor: "Scarso",
  critical: "Critico",
};

// Classi Tailwind coerenti con la palette di severita' gia' in uso
// (src/lib/geo/geo-labels.ts) — riusa i token di colore esistenti invece
// di introdurne di nuovi.
export const STATUS_CLASS: Record<AnalysisStatus, string> = {
  excellent: "bg-severity-low/10 text-accent border-accent/30",
  good: "bg-severity-low/10 text-severity-low border-severity-low/30",
  needs_improvement: "bg-severity-medium/10 text-severity-medium border-severity-medium/30",
  poor: "bg-severity-high/10 text-severity-high border-severity-high/30",
  critical: "bg-severity-high/15 text-severity-high border-severity-high/40",
};

// 5 livelli (brief sezione 41), sostituiscono i 3 livelli storici di
// IssueSeverity per Finding/Recommendation di questo modulo.
export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critico",
  high: "Alto",
  medium: "Medio",
  low: "Basso",
  info: "Info",
};

export function sortBySeverity<T extends { severity: Severity }>(items: T[]): T[] {
  return [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
