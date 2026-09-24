import type { GeoCategoryKey as DbGeoCategoryKey, GeoIssueSeverity as DbGeoIssueSeverity } from "@prisma/client";
import type { GeoCategoryKey, GeoIssueSeverity } from "./geo-types";

const CATEGORY_TO_DB: Record<GeoCategoryKey, DbGeoCategoryKey> = {
  ai_accessibility: "AI_ACCESSIBILITY",
  semantic_understanding: "SEMANTIC_UNDERSTANDING",
  entity_clarity: "ENTITY_CLARITY",
  information_completeness: "INFORMATION_COMPLETENESS",
  answerability: "ANSWERABILITY",
  content_structure: "CONTENT_STRUCTURE",
  trust_signals: "TRUST_SIGNALS",
  structured_data: "STRUCTURED_DATA",
  local_geo: "LOCAL_GEO",
};

const CATEGORY_FROM_DB: Record<DbGeoCategoryKey, GeoCategoryKey> = {
  AI_ACCESSIBILITY: "ai_accessibility",
  SEMANTIC_UNDERSTANDING: "semantic_understanding",
  ENTITY_CLARITY: "entity_clarity",
  INFORMATION_COMPLETENESS: "information_completeness",
  ANSWERABILITY: "answerability",
  CONTENT_STRUCTURE: "content_structure",
  TRUST_SIGNALS: "trust_signals",
  STRUCTURED_DATA: "structured_data",
  LOCAL_GEO: "local_geo",
};

export function toDbGeoCategory(value: GeoCategoryKey): DbGeoCategoryKey {
  return CATEGORY_TO_DB[value];
}

export function fromDbGeoCategory(value: DbGeoCategoryKey): GeoCategoryKey {
  return CATEGORY_FROM_DB[value];
}

const SEVERITY_TO_DB: Record<GeoIssueSeverity, DbGeoIssueSeverity> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

const SEVERITY_FROM_DB: Record<DbGeoIssueSeverity, GeoIssueSeverity> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
};

export function toDbGeoSeverity(value: GeoIssueSeverity): DbGeoIssueSeverity {
  return SEVERITY_TO_DB[value];
}

export function fromDbGeoSeverity(value: DbGeoIssueSeverity): GeoIssueSeverity {
  return SEVERITY_FROM_DB[value];
}
