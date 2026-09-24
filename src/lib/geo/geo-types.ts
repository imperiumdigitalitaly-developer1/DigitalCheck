// Tipi del modulo GEO (Generative Engine Optimization). Parallelo al
// modello SEO (types/index.ts) ma volutamente distinto: valuta la
// predisposizione del sito a essere compreso, citato e sintetizzato da
// motori di ricerca generativi e AI answer engine — non un duplicato
// della SEO (brief sezione 2).

export type GeoCategoryKey =
  | "ai_accessibility"
  | "semantic_understanding"
  | "entity_clarity"
  | "information_completeness"
  | "answerability"
  | "content_structure"
  | "trust_signals"
  | "structured_data"
  | "local_geo";

// 4 livelli (brief sezione 16). Il quinto livello "Good" del brief non e'
// una severita' di problema: e' rappresentato come voce di
// GeoReport.strengths, mai come GeoIssue.
export type GeoIssueSeverity = "critical" | "high" | "medium" | "low";

export interface GeoCategoryScore {
  category: GeoCategoryKey;
  score: number; // 0-100
  weight: number; // peso EFFETTIVO usato nella somma pesata (0 se non applicabile)
  applicable: boolean; // false solo per local_geo su attivita' non locali
  notes?: string;
}

export interface GeoIssue {
  category: GeoCategoryKey;
  title: string;
  description: string; // dato osservato (brief sezione 36: mai "l'AI pensa che...")
  whyItMatters: string;
  recommendation: string;
  example?: string;
  severity: GeoIssueSeverity;
}

// Entita' e segnali di brand/organizzazione rilevati (brief sezione 3).
// Tutti i campi sono "rilevato tecnicamente", non verificati esternamente.
export interface EntityData {
  businessNameCandidates: string[]; // da <title>, og:site_name, JSON-LD name
  detectedSchemaTypes: string[]; // valori @type di JSON-LD trovati sul sito
  organizationSchemaPresent: boolean;
  localBusinessSchemaPresent: boolean;
  personSchemaPresent: boolean;
  productOrServiceSchemaPresent: boolean;
  faqSchemaPresent: boolean;
  breadcrumbSchemaPresent: boolean;
  reviewSchemaPresent: boolean;
  sameAsLinks: string[];
  contact: {
    phonePresent: boolean;
    emailPresent: boolean;
    addressPresent: boolean;
  };
  googleBusinessProfileLinkPresent: boolean;
}

export interface InformationCompletenessItem {
  question: string;
  status: "answered" | "missing";
  evidence?: string;
}

export interface AnswerabilityQuery {
  query: string;
  answered: boolean;
  evidence?: string;
}

export interface GeoReport {
  overallScore: number;
  localApplicable: boolean;
  categoryScores: GeoCategoryScore[];
  issues: GeoIssue[];
  strengths: string[];
  entities: EntityData;
  informationCompleteness: InformationCompletenessItem[];
  answerabilityQueries: AnswerabilityQuery[];
  // Interpretazione AI (Pro): null se il piano non la include o se questa
  // scansione non e' riuscita a generarla — mai finta.
  aiSummary: string | null;
  aiComparisonNote: string | null;
  generatedAt: string;

  // Presenti solo per il piano Free (mirror di DigitalCheckReport, vedi
  // src/lib/billing/report-tiering.ts).
  isFreePreview?: boolean;
  hiddenIssueCount?: number;
}
