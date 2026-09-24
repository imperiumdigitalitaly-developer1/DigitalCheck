import { prisma } from "@/lib/db/prisma";
import { fromDbBusinessType, fromDbSeverity } from "@/lib/db/enum-map";
import { fromDbGeoCategory, fromDbGeoSeverity } from "@/lib/geo/geo-enum-map";
import { scoreLabel } from "@/lib/scoring/weights";
import type { AiAnalysis, CategoryKey, DigitalCheckReport, IssueCategory } from "@/types";
import type { AnswerabilityQuery, EntityData, GeoReport, InformationCompletenessItem } from "@/lib/geo/geo-types";

export async function buildReportFromScan(scanId: string): Promise<DigitalCheckReport | null> {
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    include: {
      site: true,
      scores: true,
      issues: true,
      recommendations: { orderBy: { priority: "asc" } },
      geoAnalysis: { include: { categoryScores: true, issues: true } },
    },
  });

  if (!scan || scan.status !== "COMPLETED" || scan.overallScore == null) return null;

  // Ricostruita solo se lo scan ha effettivamente prodotto un'analisi GEO
  // (scan storici precedenti all'introduzione del modulo GEO non ne hanno
  // una): mai un punteggio GEO inventato per uno scan che non l'ha mai
  // calcolato.
  const geo: GeoReport | null = scan.geoAnalysis
    ? {
        overallScore: scan.geoAnalysis.overallScore,
        localApplicable: scan.geoAnalysis.localApplicable,
        categoryScores: scan.geoAnalysis.categoryScores.map((c) => ({
          category: fromDbGeoCategory(c.category),
          score: c.score,
          weight: c.weight,
          applicable: c.applicable,
          notes: c.notes ?? undefined,
        })),
        issues: scan.geoAnalysis.issues.map((i) => ({
          category: fromDbGeoCategory(i.category),
          title: i.title,
          description: i.description,
          whyItMatters: i.whyItMatters,
          recommendation: i.recommendation,
          example: i.example ?? undefined,
          severity: fromDbGeoSeverity(i.severity),
        })),
        strengths: scan.geoAnalysis.strengths,
        entities: scan.geoAnalysis.entities as unknown as EntityData,
        informationCompleteness: scan.geoAnalysis.informationCompleteness as unknown as InformationCompletenessItem[],
        answerabilityQueries: scan.geoAnalysis.answerabilityQueries as unknown as AnswerabilityQuery[],
        aiSummary: scan.geoAnalysis.aiSummary,
        aiComparisonNote: scan.geoAnalysis.aiComparisonNote,
        generatedAt: scan.geoAnalysis.createdAt.toISOString(),
      }
    : null;

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
    geo,
  };
}
