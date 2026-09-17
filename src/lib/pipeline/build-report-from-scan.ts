import { prisma } from "@/lib/db/prisma";
import { fromDbBusinessType, fromDbSeverity } from "@/lib/db/enum-map";
import { scoreLabel } from "@/lib/scoring/weights";
import type { AiAnalysis, CategoryKey, DigitalCheckReport, IssueCategory } from "@/types";

export async function buildReportFromScan(scanId: string): Promise<DigitalCheckReport | null> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: { site: true, scores: true, issues: true, recommendations: { orderBy: { priority: "asc" } } },
  });

  if (!scan || scan.status !== "COMPLETED" || scan.overallScore == null) return null;

  // Ricostruita solo se l'AI aveva effettivamente prodotto un'analisi al
  // momento dello scan (mai inventata a posteriori): permette a PDF e
  // pagina di dettaglio, generati da uno scan storico, di mostrare la
  // stessa interpretazione vista subito dopo la scansione.
  const aiAnalysis: AiAnalysis | null =
    scan.aiConversionAnalysis || scan.aiContentAnalysis || scan.aiPriorities.length > 0
      ? {
          summary: scan.businessImpactSummary ?? "",
          strengths: scan.strengths,
          issues: [],
          priorities: scan.aiPriorities,
          conversionAnalysis: scan.aiConversionAnalysis ?? "",
          contentAnalysis: scan.aiContentAnalysis ?? "",
        }
      : null;

  return {
    requestedUrl: scan.site.url,
    businessType: fromDbBusinessType(scan.site.businessType),
    goal: scan.site.goal as DigitalCheckReport["goal"],
    generatedAt: (scan.completedAt ?? scan.startedAt).toISOString(),
    pagesAnalyzed: scan.pagesCrawled,
    overallScore: scan.overallScore,
    categoryScores: scan.scores.map((s) => ({
      category: s.category as CategoryKey,
      score: s.score,
      weight: s.weight,
      verified: true,
    })),
    issues: scan.issues.map((i) => ({
      title: i.title,
      description: i.description,
      whyItMatters: i.whyItMatters,
      evidence: i.evidence ?? undefined,
      recommendation: i.recommendation,
      severity: fromDbSeverity(i.severity),
      category: i.category as IssueCategory,
    })),
    strengths: scan.strengths,
    recommendedActions: scan.recommendations.map((r) => r.title),
    businessImpactSummary:
      scan.businessImpactSummary ?? `Punteggio complessivo: ${scan.overallScore}/100 (${scoreLabel(scan.overallScore)}).`,
    aiAnalysis,
    unverifiable: scan.unverifiable,
  };
}
