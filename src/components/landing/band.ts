// 5 fasce del Digital Score mostrate in homepage (Critico/Da migliorare/
// Buono/Molto buono/Eccellente): stessa logica e stessi colori gia' usati
// nella sezione "Il Digital Score" della homepage precedente e nella
// palette "score" di tailwind.config.js — riusati qui, non reinventati.
export type ScoreBand = "critical" | "weak" | "good" | "strong" | "excellent";

export function scoreBand(score: number): ScoreBand {
  if (score < 40) return "critical";
  if (score < 60) return "weak";
  if (score < 75) return "good";
  if (score < 90) return "strong";
  return "excellent";
}

export const BAND_HEX: Record<ScoreBand, string> = {
  critical: "#B4483F",
  weak: "#C97A3D",
  good: "#3F7D8F",
  strong: "#1F6F64",
  excellent: "#2F7A4F",
};

export const BAND_LABEL: Record<ScoreBand, string> = {
  critical: "Critico",
  weak: "Da migliorare",
  good: "Buono",
  strong: "Molto buono",
  excellent: "Eccellente",
};

export function scoreColorHex(score: number): string {
  return BAND_HEX[scoreBand(score)];
}
