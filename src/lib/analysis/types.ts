import type { CategoryKey } from "@/types";

// Sistema di audit multi-categoria (brief "audit professionale"). Modello
// dati comune riusabile per le 7 categorie SEO-side (seo/performance/
// mobile/conversion/content/accessibility/technical) — brief sezione 40.
// Il GEO ha gia' un proprio modello parallelo (src/lib/geo/geo-types.ts) e
// NON viene riscritto qui: resta la fonte di verita' per se stesso, ed e'
// solo adattato a questa shape ai bordi (cross-analysis, action plan,
// dashboard) senza duplicarne la logica di analisi.

// 5 livelli, centralizzati (brief sezione 41): sostituisce i 3 livelli
// storici di IssueSeverity per i Finding/Recommendation di questo modulo.
export type Severity = "critical" | "high" | "medium" | "low" | "info";

// 5 fasce di valutazione (brief sezione 4), comuni a tutte le 8 categorie
// (incluso GEO nella presentazione unificata) — vedi scoreToStatus().
export type AnalysisStatus = "excellent" | "good" | "needs_improvement" | "poor" | "critical";

// Distingue dato misurato da stima, senza mai inventare uno 0 quando un
// dato manca (brief sezione 34).
export type DataAvailability = "verified" | "partial" | "unavailable" | "not_applicable";

export interface SubScore {
  key: string;
  label: string;
  score: number; // 0-100
  weight: number; // 0-1, pesi di una categoria sommano a 1
  dataAvailability: DataAvailability;
}

// Un problema rilevato (brief sezione 42: dato osservato, non ancora
// un'azione). Erede concettuale di ScanIssue ma con severita' a 5 livelli
// e agganciato esplicitamente a una categoria.
export interface Finding {
  title: string;
  severity: Severity;
  category: CategoryKey;
  evidence?: string;
  explanation: string; // "perche' conta"
  impact: string; // area/effetto potenziale
}

// Oggetto Recommendation dedicato (brief sezione 42), non piu' una
// stringa nuda: ogni raccomandazione porta con se' severita', spiegazione,
// impatto, azione concreta ed evidenza a supporto.
export interface Recommendation {
  title: string;
  category: CategoryKey;
  severity: Severity;
  explanation: string;
  impact: string;
  action: string;
  evidence?: string;
}

export interface AnalysisResult {
  category: CategoryKey;
  score: number; // 0-100, deterministico e riproducibile (brief sezione 3)
  status: AnalysisStatus;
  dataAvailability: DataAvailability;
  subScores: SubScore[];
  // Metriche grezze rilevate, per mostrarle nel PDF Pro senza doverle
  // ricalcolare (brief sezione 6: "dato misurato" vs raccomandazione).
  // Valore null esplicito quando non disponibile — mai omesso silenziosamente.
  // L'elenco {label,present}[] copre dati tabellari gia' calcolati (es.
  // Security Headers): resta un dato grezzo, non una nuova analisi.
  metrics: Record<string, string | number | boolean | null | { label: string; present: boolean }[]>;
  strengths: string[];
  findings: Finding[];
  recommendations: Recommendation[];
  // Frase sintetica per la dashboard executive (brief sezione 14): MAI
  // problemi/consigli, solo descrizione generale. Fallback deterministico;
  // puo' essere sostituita dall'interpretazione AI (src/lib/ai/audit-analyzer.ts).
  shortSummary: string;
  notes?: string;
}
