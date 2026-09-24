import type { BusinessType as DbBusinessType, IssueSeverity as DbIssueSeverity } from "@prisma/client";
import type { BusinessType, IssueSeverity } from "@/types";
import type { Severity } from "@/lib/analysis/types";

const BUSINESS_TYPE_TO_DB: Record<BusinessType, DbBusinessType> = {
  bnb: "BNB",
  hotel: "HOTEL",
  restaurant: "RESTAURANT",
  shop: "SHOP",
  professional: "PROFESSIONAL",
  other: "OTHER",
};

const BUSINESS_TYPE_FROM_DB: Record<DbBusinessType, BusinessType> = {
  BNB: "bnb",
  HOTEL: "hotel",
  RESTAURANT: "restaurant",
  SHOP: "shop",
  PROFESSIONAL: "professional",
  OTHER: "other",
};

export function toDbBusinessType(value: BusinessType): DbBusinessType {
  return BUSINESS_TYPE_TO_DB[value];
}

export function fromDbBusinessType(value: DbBusinessType): BusinessType {
  return BUSINESS_TYPE_FROM_DB[value];
}

const SEVERITY_TO_DB: Record<IssueSeverity, DbIssueSeverity> = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

// IssueSeverity (3 livelli, app) e' rimasto invariato per lo ScanIssue/
// AiAnalysis storici (mai scritti con CRITICAL/INFO): CRITICAL/INFO qui
// sono collassati su high/low solo per completezza del mapping, dato che
// il DB ora ha 5 valori (estensione additiva per il nuovo Finding/
// Recommendation a 5 livelli — vedi toDbSeverity5/fromDbSeverity5 sotto).
const SEVERITY_FROM_DB: Record<DbIssueSeverity, IssueSeverity> = {
  CRITICAL: "high",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  INFO: "low",
};

export function toDbSeverity(value: IssueSeverity): DbIssueSeverity {
  return SEVERITY_TO_DB[value];
}

export function fromDbSeverity(value: DbIssueSeverity): IssueSeverity {
  return SEVERITY_FROM_DB[value];
}

// Mapping a 5 livelli (brief audit sezione 41) per Finding/Recommendation
// del nuovo sistema multi-categoria: IssueSeverity a DB ora ha anche
// CRITICAL/INFO (migrazione additiva), usati SOLO da queste funzioni — il
// mapping a 3 livelli sopra resta invariato per ScanIssue/AiAnalysis
// esistenti (SEO/GEO side, mai toccati da questo refactor).
const SEVERITY5_TO_DB: Record<Severity, DbIssueSeverity> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
  info: "INFO",
};

const SEVERITY5_FROM_DB: Record<DbIssueSeverity, Severity> = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  INFO: "info",
};

export function toDbSeverity5(value: Severity): DbIssueSeverity {
  return SEVERITY5_TO_DB[value];
}

export function fromDbSeverity5(value: DbIssueSeverity): Severity {
  return SEVERITY5_FROM_DB[value];
}
