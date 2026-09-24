import { crawlSite } from "@/lib/crawler/crawler";
import { analyzeSeoFacts } from "@/lib/analysis/seo-analyzer";
import { fetchPageSpeedFull } from "@/lib/analysis/pagespeed";
import { analyzeSeo } from "@/lib/analysis/categories/seo";
import { analyzeTechnical } from "@/lib/analysis/categories/technical";
import { analyzePerformance } from "@/lib/analysis/categories/performance";
import { analyzeMobile } from "@/lib/analysis/categories/mobile";
import { analyzeConversion } from "@/lib/analysis/categories/conversion";
import { analyzeContent } from "@/lib/analysis/categories/content";
import { analyzeAccessibility } from "@/lib/analysis/categories/accessibility";
import { computeMasterScore } from "@/lib/analysis/master-score";
import { computeCrossAnalysis, type CrossAnalysisInsight } from "@/lib/analysis/cross-analysis";
import { computeActionPlan } from "@/lib/analysis/action-plan";
import { STATUS_LABEL, scoreToStatus } from "@/lib/analysis/constants";
import { CATEGORY_TO_ISSUE_GROUP, collapseToLegacySeverity } from "@/lib/analysis/legacy-map";
import type { AnalysisResult } from "@/lib/analysis/types";
import { runContentAnalysis } from "@/lib/ai/content-analyzer";
import { computeGeoAnalysis } from "@/lib/geo/geo-scoring";
import { runGeoAiAnalysis } from "@/lib/ai/geo-analyzer";
import { runAuditAiAnalysis } from "@/lib/ai/audit-analyzer";
import type { GeoReport } from "@/lib/geo/geo-types";
import { CATEGORY_LABELS } from "@/lib/category-labels";
import type {
  BusinessGoal,
  BusinessType,
  CategoryKey,
  CategoryScore,
  CrawlResult,
  DigitalCheckReport,
  ScanIssue,
  SeoFacts,
} from "@/types";

export interface ScanPipelineSuccess {
  ok: true;
  crawl: CrawlResult;
  facts: SeoFacts;
  report: DigitalCheckReport;
}

export interface ScanPipelineFailure {
  ok: false;
  errorCode: string;
  errorMessage: string; // messaggio pensato per l'utente finale, non tecnico
}

export type ScanPipelineResult = ScanPipelineSuccess | ScanPipelineFailure;

// Ordine di presentazione storico (CATEGORY_LABELS, scorecard PDF): usato
// per costruire l'array analyses[] in un ordine stabile e prevedibile.
const CATEGORY_ORDER: CategoryKey[] = ["seo", "performance", "mobile", "content", "conversion", "accessibility", "technical"];

export async function runScanPipeline(
  url: string,
  businessType: BusinessType,
  goal: BusinessGoal,
  maxPages: number
): Promise<ScanPipelineResult> {
  const crawl = await crawlSite(url, { maxPages });

  if (crawl.pages.length === 0) {
    const error = crawl.errors[0];
    return {
      ok: false,
      errorCode: error?.code ?? "UNKNOWN",
      errorMessage:
        error?.code === "INVALID_URL"
          ? "L'indirizzo inserito non e' un URL valido."
          : "Non e' stato possibile raggiungere il sito. Verifica che l'indirizzo sia corretto e che il sito sia pubblicamente accessibile.",
    };
  }

  const facts = analyzeSeoFacts(crawl);

  // Un'unica chiamata a PageSpeed Insights (strategia mobile), riusata sia
  // da Performance sia da Mobile Performance (brief audit sezione 32: mai
  // due scansioni indipendenti dello stesso sito quando il dato e'
  // condivisibile).
  const psi = await fetchPageSpeedFull(url);

  // GEO: motore data-driven puro (nessuna chiamata di rete/AI), sincrono.
  const geoScoring = computeGeoAnalysis(crawl, facts, businessType);

  // Le 7 categorie SEO-side: tutte sincrone e pure, operano sui dati gia'
  // raccolti dal crawl condiviso (brief audit sezione 2: mai duplicare la
  // logica di analisi tra i motori).
  const analyses: AnalysisResult[] = [
    analyzeSeo(facts, crawl),
    analyzePerformance(psi, crawl),
    analyzeMobile(facts, crawl, psi),
    analyzeContent(facts, crawl),
    analyzeConversion(crawl, businessType),
    analyzeAccessibility(facts, crawl),
    analyzeTechnical(facts, crawl),
  ].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));

  const { score: masterScore, weights: masterScoreWeights } = computeMasterScore(analyses, geoScoring.overallScore, businessType);
  const crossAnalysis = computeCrossAnalysis(analyses, geoScoring.overallScore);
  const actionPlan = computeActionPlan(analyses, geoScoring.issues);

  // Le tre chiamate AI sono indipendenti tra loro (ricevono solo dati GIA'
  // calcolati sopra): eseguite in parallelo per non sommare i tempi (brief
  // audit sezione 32 / brief GEO sezione 25).
  const [{ analysis: aiAnalysis, unavailableReason: contentAiUnavailable }, geoAi, auditAi] = await Promise.all([
    runContentAnalysis(facts, crawl, businessType, goal),
    runGeoAiAnalysis(
      geoScoring,
      masterScore,
      analyses.flatMap((a) => a.findings.filter((f) => f.severity === "critical" || f.severity === "high").map((f) => f.title)).slice(0, 5),
      businessType,
      goal
    ),
    runAuditAiAnalysis(
      analyses,
      geoScoring.overallScore,
      geoScoring.issues,
      masterScore,
      crossAnalysis.map((c) => c.pairLabel),
      businessType,
      goal
    ),
  ]);

  const geo: GeoReport = {
    overallScore: geoScoring.overallScore,
    localApplicable: geoScoring.localApplicable,
    categoryScores: geoScoring.categoryScores,
    issues: geoScoring.issues,
    strengths: geoScoring.strengths,
    entities: geoScoring.entities,
    informationCompleteness: geoScoring.informationCompleteness,
    answerabilityQueries: geoScoring.answerabilityQueries,
    aiSummary: geoAi.summary,
    aiComparisonNote: geoAi.comparisonNote,
    generatedAt: new Date().toISOString(),
  };

  // Applica l'interpretazione AI dell'audit (quando disponibile) sopra le
  // frasi sintetiche deterministiche gia' calcolate da ogni motore di
  // categoria — mai l'AI al posto del dato, solo come rifinitura del testo
  // (brief audit sezione 3: l'AI interpreta, non decide il punteggio).
  const analysesWithAiSummaries: AnalysisResult[] = analyses.map((a) => ({
    ...a,
    shortSummary: auditAi.categorySummaries[a.category] ?? a.shortSummary,
  }));

  const geoShortSummary =
    auditAi.categorySummaries.geo ??
    (geo.overallScore >= 60
      ? "Il sito ha una predisposizione discreta a essere compreso da motori di ricerca generativi e AI answer engine."
      : "Il sito ha margini di miglioramento significativi nella predisposizione a essere compreso da motori di ricerca generativi e AI answer engine.");

  const crossAnalysisWithAiNotes: CrossAnalysisInsight[] = crossAnalysis.map((c) => ({
    ...c,
    note: auditAi.crossAnalysisNotes[c.pairLabel] ?? c.note,
  }));

  const unverifiable: string[] = [];
  for (const a of analysesWithAiSummaries) {
    if (a.dataAvailability !== "verified") {
      unverifiable.push(`${CATEGORY_LABELS[a.category]}: ${a.notes ?? "dato parziale o non disponibile automaticamente."}`);
    }
  }
  if (contentAiUnavailable) unverifiable.push(contentAiUnavailable);
  if (geoAi.unavailableReason) unverifiable.push(geoAi.unavailableReason);
  if (auditAi.unavailableReason) unverifiable.push(auditAi.unavailableReason);

  // ---- Campi legacy, derivati dal nuovo sistema per compatibilita' con i
  // consumer esistenti (Gestionale, storico scan, PDF non ancora migrato) —
  // brief audit sezione 45: non rompere l'esistente. ----------------------
  const categoryScores: CategoryScore[] = analysesWithAiSummaries.map((a) => ({
    category: a.category,
    score: a.score,
    weight: masterScoreWeights[a.category] ?? 0,
    verified: a.dataAvailability === "verified",
    notes: a.notes,
  }));

  const legacyIssues: ScanIssue[] = analysesWithAiSummaries.flatMap((a) =>
    a.findings.map((f) => ({
      title: f.title,
      description: f.explanation,
      whyItMatters: f.explanation,
      evidence: f.evidence,
      recommendation: a.recommendations.find((r) => r.title === f.title)?.action ?? f.impact,
      severity: collapseToLegacySeverity(f.severity),
      category: CATEGORY_TO_ISSUE_GROUP[a.category],
    }))
  );
  const aiIssues: ScanIssue[] = (aiAnalysis?.issues ?? []).map((i) => ({
    title: i.title,
    description: i.explanation,
    whyItMatters: i.explanation,
    recommendation: i.recommendation,
    severity: i.severity,
    category: i.category,
  }));

  const strengths =
    auditAi.mainStrengths.length > 0 ? auditAi.mainStrengths : analysesWithAiSummaries.flatMap((a) => a.strengths).slice(0, 6);
  const recommendedActions =
    auditAi.strategicRecommendations.length > 0 ? auditAi.strategicRecommendations : actionPlan.slice(0, 5).map((a) => a.action);

  const businessImpactSummary =
    auditAi.executiveSummary ??
    `DigitalCheck Score complessivo: ${masterScore}/100 (${STATUS_LABEL[scoreToStatus(masterScore)]}). Interpretazione AI non disponibile in questa scansione: il punteggio si basa sui controlli tecnici automatici delle 8 categorie.`;

  const report: DigitalCheckReport = {
    requestedUrl: url,
    businessType,
    goal,
    generatedAt: new Date().toISOString(),
    pagesAnalyzed: crawl.pages.length,
    overallScore: masterScore,
    categoryScores,
    issues: [...legacyIssues, ...aiIssues],
    strengths,
    recommendedActions,
    businessImpactSummary,
    aiAnalysis,
    unverifiable,
    geo,
    geoShortSummary,
    analyses: analysesWithAiSummaries,
    masterScoreWeights,
    crossAnalysis: crossAnalysisWithAiNotes,
    actionPlan,
  };

  return { ok: true, crawl, facts, report };
}
