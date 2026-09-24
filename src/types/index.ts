import type { GeoReport } from "@/lib/geo/geo-types";
import type { AnalysisResult } from "@/lib/analysis/types";
import type { CrossAnalysisInsight } from "@/lib/analysis/cross-analysis";
import type { ActionPlanItem } from "@/lib/analysis/action-plan";

export type BusinessType =
  | "bnb"
  | "hotel"
  | "restaurant"
  | "shop"
  | "professional"
  | "other";

export type BusinessGoal =
  | "increase_bookings"
  | "increase_calls"
  | "increase_quote_requests"
  | "increase_visibility"
  | "sell_products"
  | "increase_contacts";

export type CategoryKey =
  | "seo"
  | "performance"
  | "mobile"
  | "content"
  | "conversion"
  | "accessibility"
  | "technical";

export type IssueSeverity = "high" | "medium" | "low";

export type IssueCategory =
  | "technical"
  | "ux"
  | "seo"
  | "content"
  | "conversion";

export interface CrawledPage {
  url: string;
  finalUrl: string;
  statusCode: number;
  html: string;
  contentType: string;
  fetchedAt: string;
  sizeBytes: number;
  // Header di risposta HTTP della richiesta finale (dopo i redirect),
  // solo quelli rilevanti per l'analisi Technical (sicurezza/caching) —
  // brief audit sezione 11. Mai usati per altro che ispezione pubblica:
  // nessuna richiesta aggiuntiva viene fatta per raccoglierli, sono un
  // sottoprodotto del fetch gia' eseguito dal crawler.
  responseHeaders: Record<string, string>;
  // Numero di redirect seguiti per raggiungere finalUrl (0 = nessuno).
  redirectCount: number;
}

export interface CrawlResult {
  requestedUrl: string;
  pages: CrawledPage[];
  robotsTxt: { present: boolean; content?: string };
  sitemapXml: { present: boolean; url?: string };
  errors: { url: string; code: string; message: string }[];
}

// Dati tecnici grezzi estratti dall'HTML, prima di qualunque
// interpretazione. Ogni campo e' "rilevato tecnicamente" — non e' una
// verifica esterna (es. non implica indicizzazione reale su Google).
export interface SeoFacts {
  url: string;
  httpsUsed: boolean;
  statusCode: number;
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaDescriptionLength: number;
  h1: string[];
  h2Count: number;
  h3Count: number;
  canonical: string | null;
  viewportPresent: boolean;
  langAttribute: string | null;
  images: { total: number; withAlt: number };
  internalLinks: number;
  externalLinks: number;
  openGraph: { present: boolean; tags: string[] };
  structuredData: { present: boolean; types: string[] };
  robotsTxtPresent: boolean;
  sitemapPresent: boolean;
}

export interface ScanIssue {
  title: string;
  description: string;
  whyItMatters: string;
  evidence?: string;
  recommendation: string;
  severity: IssueSeverity;
  category: IssueCategory;
}

export interface CategoryScore {
  category: CategoryKey;
  score: number; // 0-100
  weight: number; // 0-1
  verified: boolean; // false se il dato e' un'inferenza, non una misura diretta
  notes?: string;
}

export interface AiAnalysis {
  summary: string;
  strengths: string[];
  issues: {
    title: string;
    category: IssueCategory;
    severity: IssueSeverity;
    explanation: string;
    recommendation: string;
  }[];
  priorities: string[];
  conversionAnalysis: string;
  contentAnalysis: string;
}

export interface DigitalCheckReport {
  requestedUrl: string;
  businessType: BusinessType;
  goal: BusinessGoal;
  generatedAt: string;
  pagesAnalyzed: number;
  overallScore: number;
  categoryScores: CategoryScore[];
  issues: ScanIssue[];
  strengths: string[];
  recommendedActions: string[];
  businessImpactSummary: string;
  aiAnalysis: AiAnalysis | null;
  unverifiable: string[]; // elenco esplicito di cio' che non e' stato possibile verificare

  // GEO — Generative Engine Optimization (brief GEO, sezioni 1-2): analisi
  // separata dalla SEO ma parte dello stesso report, stessa fonte dati,
  // stesso troncamento Free/PDF. Null solo se lo scan e' fallito prima che
  // il crawl producesse dati (mai un punteggio inventato).
  geo: GeoReport | null;
  // Frase sintetica per la dashboard executive (brief audit sezione 14),
  // parallela a AnalysisResult.shortSummary ma per il GEO (che non ha una
  // propria interpretazione AI a livello di singola frase — vedi
  // src/lib/ai/audit-analyzer.ts). Null solo se geo e' null.
  geoShortSummary: string | null;

  // ---------------------------------------------------------------------
  // Sistema di audit multi-categoria (brief "audit professionale"): fonte
  // di verita' per dashboard executive e PDF Pro. categoryScores/issues/
  // recommendedActions sopra restano popolati (derivati da analyses) solo
  // per compatibilita' con consumer esistenti (Gestionale, storico) — la
  // UI e il PDF nuovi leggono da qui.
  // ---------------------------------------------------------------------
  analyses: AnalysisResult[]; // le 7 categorie SEO-side, in ordine CategoryKey
  masterScoreWeights: Partial<Record<CategoryKey | "geo", number>>;
  crossAnalysis: CrossAnalysisInsight[];
  actionPlan: ActionPlanItem[];

  // Presenti solo quando il report e' stato troncato per il piano Free
  // (vedi src/lib/billing/report-tiering.ts): permettono all'interfaccia
  // di comunicare "ci sono altri N problemi" senza doverli inviare.
  isFreePreview?: boolean;
  hiddenIssueCount?: number;
  hiddenRecommendationCount?: number;
}
