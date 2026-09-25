import type { GeoCategoryKey, GeoIssueSeverity } from "./geo-types";

export const GEO_CATEGORY_LABELS: Record<GeoCategoryKey, string> = {
  ai_accessibility: "Accessibilita' AI",
  semantic_understanding: "Chiarezza semantica",
  entity_clarity: "Chiarezza dell'entita'",
  information_completeness: "Completezza delle informazioni",
  answerability: "Capacita' di risposta",
  content_structure: "Struttura del contenuto",
  trust_signals: "Segnali di fiducia",
  structured_data: "Dati strutturati",
  local_geo: "GEO locale",
};

export const GEO_SEVERITY_LABELS: Record<GeoIssueSeverity, { label: string; className: string }> = {
  critical: { label: "Critico", className: "bg-severity-high/10 text-severity-high border-severity-high/30" },
  high: { label: "Alto", className: "bg-severity-medium/10 text-severity-medium border-severity-medium/30" },
  medium: { label: "Medio", className: "bg-severity-low/10 text-severity-low border-severity-low/30" },
  low: { label: "Basso", className: "bg-line text-ink-soft border-line" },
};
