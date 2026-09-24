import { prisma } from "@/lib/db/prisma";
import { fromDbBusinessType, fromDbSeverity, fromDbSeverity5 } from "@/lib/db/enum-map";
import { fromDbGeoCategory, fromDbGeoSeverity } from "@/lib/geo/geo-enum-map";
import { scoreToStatus, STATUS_LABEL } from "@/lib/analysis/constants";
import { normalizeToIssueGroup } from "@/lib/analysis/legacy-map";
import { computeActionPlan } from "@/lib/analysis/action-plan";
import { GEO_WEIGHT } from "@/lib/analysis/master-score";
import type { AnalysisStatus, AnalysisResult, DataAvailability, SubScore } from "@/lib/analysis/types";
import type { CrossAnalysisInsight } from "@/lib/analysis/cross-analysis";
import type { AiAnalysis, CategoryKey, DigitalCheckReport } from "@/types";
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
  const geoShortSummary = scan.geoAnalysis?.shortSummary ?? null;

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

  // ---- Sistema di audit multi-categoria: ricostruito SOLO se lo scan ha
  // effettivamente prodotto i dati del nuovo sistema (colonna `status`
  // valorizzata) — scan precedenti all'introduzione dell'audit multi-
  // categoria non ce l'hanno, e analyses resta [] invece di inventare dati
  // (brief audit sezione 34/45: mai fingere dati che non esistono). ------
  const hasAuditData = scan.scores.some((s) => s.status != null);
  const analyses: AnalysisResult[] = hasAuditData
    ? scan.scores.map((s) => {
        const category = s.category as CategoryKey;
        const categoryIssues = scan.issues.filter((i) => i.category === category);
        const categoryRecs = scan.recommendations.filter((r) => r.category === category);
        return {
          category,
          score: s.score,
          status: (s.status as AnalysisStatus) ?? scoreToStatus(s.score),
          dataAvailability: (s.dataAvailability as DataAvailability) ?? "verified",
          subScores: (s.subScores as unknown as SubScore[]) ?? [],
          metrics: {},
          strengths: [],
          findings: categoryIssues.map((i) => ({
            title: i.title,
            severity: fromDbSeverity5(i.severity),
            category,
            evidence: i.evidence ?? undefined,
            explanation: i.whyItMatters,
            impact: i.description,
          })),
          recommendations: categoryRecs.map((r) => ({
            title: r.title,
            category: (r.category as CategoryKey) ?? category,
            severity: r.severity ? fromDbSeverity5(r.severity) : "medium",
            explanation: r.explanation ?? r.detail,
            impact: r.impact ?? "",
            action: r.action ?? r.detail,
            evidence: r.evidence ?? undefined,
          })),
          shortSummary: s.shortSummary ?? "",
          notes: s.notes ?? undefined,
        };
      })
    : [];

  const masterScoreWeights: DigitalCheckReport["masterScoreWeights"] = {};
  for (const s of scan.scores) masterScoreWeights[s.category as CategoryKey] = s.weight;
  if (geo) masterScoreWeights.geo = GEO_WEIGHT;

  const crossAnalysis = (scan.auditCrossAnalysis as unknown as CrossAnalysisInsight[] | null) ?? [];
  const actionPlan = hasAuditData ? computeActionPlan(analyses, geo?.issues ?? []) : [];

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
      verified: (s.dataAvailability as DataAvailability | null) ? s.dataAvailability === "verified" : true,
      notes: s.notes ?? undefined,
    })),
    issues: scan.issues.map((i) => ({
      title: i.title,
      description: i.description,
      whyItMatters: i.whyItMatters,
      evidence: i.evidence ?? undefined,
      recommendation: i.recommendation,
      severity: fromDbSeverity(i.severity),
      category: normalizeToIssueGroup(i.category),
    })),
    strengths: scan.strengths,
    recommendedActions: scan.recommendations.map((r) => r.title),
    businessImpactSummary:
      scan.businessImpactSummary ?? `DigitalCheck Score complessivo: ${scan.overallScore}/100 (${STATUS_LABEL[scoreToStatus(scan.overallScore)]}).`,
    aiAnalysis,
    unverifiable: scan.unverifiable,
    geo,
    geoShortSummary,
    analyses,
    masterScoreWeights,
    crossAnalysis,
    actionPlan,
  };
}
