import { crawlSite } from "@/lib/crawler/crawler";
import { analyzeSeoFacts } from "@/lib/analysis/seo-analyzer";
import { computeScoring, type ScoringOutput } from "@/lib/scoring/scoring-engine";
import { scoreLabel } from "@/lib/scoring/weights";
import { runContentAnalysis } from "@/lib/ai/content-analyzer";
import type { BusinessGoal, BusinessType, CrawlResult, DigitalCheckReport, SeoFacts } from "@/types";

export interface ScanPipelineSuccess {
  ok: true;
  crawl: CrawlResult;
  facts: SeoFacts;
  scoring: ScoringOutput;
  report: DigitalCheckReport;
}

export interface ScanPipelineFailure {
  ok: false;
  errorCode: string;
  errorMessage: string; // messaggio pensato per l'utente finale, non tecnico
}

export type ScanPipelineResult = ScanPipelineSuccess | ScanPipelineFailure;

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
  const scoring = await computeScoring({ facts, crawl, businessType, url });
  const { analysis: aiAnalysis, unavailableReason } = await runContentAnalysis(
    facts,
    crawl,
    businessType,
    goal
  );

  const unverifiable = [...scoring.unverifiable];
  if (unavailableReason) unverifiable.push(unavailableReason);

  const categoryScores = scoring.categoryScores.map((c) =>
    c.category === "content" && aiAnalysis ? { ...c, verified: true, notes: undefined } : c
  );

  const aiIssues = (aiAnalysis?.issues ?? []).map((i) => ({
    title: i.title,
    description: i.explanation,
    whyItMatters: i.explanation,
    recommendation: i.recommendation,
    severity: i.severity,
    category: i.category,
  }));

  const report: DigitalCheckReport = {
    requestedUrl: url,
    businessType,
    goal,
    generatedAt: new Date().toISOString(),
    pagesAnalyzed: crawl.pages.length,
    overallScore: scoring.overallScore,
    categoryScores,
    issues: [...scoring.issues, ...aiIssues],
    strengths: aiAnalysis?.strengths ?? [],
    recommendedActions:
      aiAnalysis?.priorities ??
      scoring.issues
        .filter((i) => i.severity === "high")
        .slice(0, 5)
        .map((i) => i.recommendation),
    businessImpactSummary:
      aiAnalysis?.summary ??
      `Punteggio complessivo: ${scoring.overallScore}/100 (${scoreLabel(
        scoring.overallScore
      )}). Analisi AI non disponibile in questa scansione: le indicazioni sotto si basano sui controlli tecnici automatici.`,
    aiAnalysis,
    unverifiable,
  };

  return { ok: true, crawl, facts, scoring, report };
}
