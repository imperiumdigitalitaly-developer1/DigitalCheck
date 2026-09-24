import type { CategoryKey, IssueCategory, IssueSeverity } from "@/types";
import type { Severity } from "./types";

// Mappature verso le taxonomy storiche a 3 livelli/5 categorie (types/
// index.ts IssueSeverity/IssueCategory), usate SOLO per popolare i campi
// legacy di DigitalCheckReport (report.issues, report.categoryScores) a
// beneficio dei consumer non ancora migrati al nuovo sistema di audit
// (brief audit sezione 45: non rompere l'esistente). La fonte di verita'
// resta sempre analyses[] (5 livelli, 7 categorie).
export function collapseToLegacySeverity(severity: Severity): IssueSeverity {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

// mobile confluisce in "technical", accessibility in "ux": stessa
// granularita' grezza gia' usata dal motore legacy.
export const CATEGORY_TO_ISSUE_GROUP: Record<CategoryKey, IssueCategory> = {
  seo: "seo",
  performance: "technical",
  mobile: "technical",
  content: "content",
  conversion: "conversion",
  accessibility: "ux",
  technical: "technical",
};

// Normalizza una stringa category persistita in ScanIssue.category verso
// IssueCategory: la colonna e' condivisa da due epoche di dati (righe
// storiche gia' scritte in IssueCategory prima dell'audit multi-categoria,
// righe nuove scritte in CategoryKey da run-scan.ts) — seo/technical/
// content/conversion coincidono testualmente nei due schemi, solo
// mobile/accessibility (solo in CategoryKey) vanno rimappate.
export function normalizeToIssueGroup(raw: string): IssueCategory {
  if (raw === "mobile") return "technical";
  if (raw === "accessibility") return "ux";
  if (raw === "seo" || raw === "technical" || raw === "content" || raw === "conversion" || raw === "ux") return raw;
  return "technical";
}
