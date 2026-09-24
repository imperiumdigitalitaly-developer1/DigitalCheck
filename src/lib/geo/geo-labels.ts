import type { GeoCategoryKey, GeoIssueSeverity } from "./geo-types";

export const GEO_CATEGORY_LABELS: Record<GeoCategoryKey, string> = {
  ai_accessibility: "AI Accessibility",
  semantic_understanding: "Semantic Understanding",
  entity_clarity: "Entity Clarity",
  information_completeness: "Information Completeness",
  answerability: "Answerability",
  content_structure: "Content Structure",
  trust_signals: "Trust Signals",
  structured_data: "Structured Data",
  local_geo: "Local GEO",
};

export const GEO_SEVERITY_LABELS: Record<GeoIssueSeverity, { label: string; className: string }> = {
  critical: { label: "Critico", className: "bg-severity-high/10 text-severity-high border-severity-high/30" },
  high: { label: "Alto", className: "bg-severity-medium/10 text-severity-medium border-severity-medium/30" },
  medium: { label: "Medio", className: "bg-severity-low/10 text-severity-low border-severity-low/30" },
  low: { label: "Basso", className: "bg-line text-ink-soft border-line" },
};
