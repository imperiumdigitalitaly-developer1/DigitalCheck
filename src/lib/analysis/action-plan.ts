import type { CategoryKey } from "@/types";
import type { GeoIssue } from "@/lib/geo/geo-types";
import { SEVERITY_ORDER } from "./constants";
import type { AnalysisResult, Severity } from "./types";

// Priority Action Plan (brief audit sezione 27): unifica le raccomandazioni
// di tutte le 8 categorie (7 SEO-side + GEO) in un'unica lista ordinata per
// impatto/gravita', non piu' un elenco per categoria separato. Le priorita'
// non sono arbitrarie: derivano dalla severita' gia' assegnata da ciascun
// motore di categoria (mai un ordine deciso qui senza base nei dati).
export interface ActionPlanItem {
  priority: number;
  title: string;
  category: CategoryKey | "geo";
  severity: Severity;
  why: string;
  action: string;
  // Gia' calcolato da ogni motore di categoria (Recommendation.impact):
  // undefined per gli item GEO, che non hanno un campo impact distinto
  // da whyItMatters — mai un valore inventato qui per riempire il vuoto.
  impact?: string;
}

// GEO ha 4 livelli (critical/high/medium/low, niente "info"): mappatura
// diretta 1:1 nella scala unificata a 5 livelli, senza perdita di
// informazione (src/lib/geo/geo-types.ts GeoIssueSeverity).
function geoSeverityToUnified(severity: "critical" | "high" | "medium" | "low"): Severity {
  return severity;
}

const MAX_ACTION_PLAN_ITEMS = 20;

export function computeActionPlan(analyses: AnalysisResult[], geoIssues: GeoIssue[]): ActionPlanItem[] {
  const items: ActionPlanItem[] = [];

  for (const result of analyses) {
    for (const rec of result.recommendations) {
      items.push({
        priority: 0,
        title: rec.title,
        category: rec.category,
        severity: rec.severity,
        why: rec.explanation,
        action: rec.action,
        impact: rec.impact,
      });
    }
  }

  for (const issue of geoIssues) {
    items.push({
      priority: 0,
      title: issue.title,
      category: "geo",
      severity: geoSeverityToUnified(issue.severity),
      why: issue.whyItMatters,
      action: issue.recommendation,
    });
  }

  const sorted = items
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, MAX_ACTION_PLAN_ITEMS);

  return sorted.map((item, index) => ({ ...item, priority: index + 1 }));
}
