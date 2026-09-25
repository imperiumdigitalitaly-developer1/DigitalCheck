import { prisma } from "@/lib/db/prisma";
import { runScanPipeline } from "@/lib/pipeline/run-scan";
import { fromDbBusinessType, toDbSeverity5 } from "@/lib/db/enum-map";
import { toDbGeoCategory, toDbGeoSeverity } from "@/lib/geo/geo-enum-map";
import { getPlanLimits } from "@/lib/billing/plan-limits";
import type { BusinessGoal } from "@/types";
import { Prisma, type Site, type User } from "@prisma/client";

export interface PersistScanResult {
  ok: boolean;
  scanId: string;
  errorMessage?: string;
}

export async function persistScanForSite(site: Site, owner: User): Promise<PersistScanResult> {
  const limits = await getPlanLimits(owner.plan);

  const scan = await prisma.scan.create({ data: { siteId: site.id, status: "REQUESTED" } });

  // Consumo di quota registrato subito e in modo indipendente dallo scan
  // stesso: se lo scan (o il sito a cui appartiene) viene poi eliminato,
  // la quota gia' usata in questo periodo non deve tornare disponibile.
  await prisma.usageEvent.create({ data: { userId: site.ownerId, type: "SCAN" } });

  try {
    await prisma.scan.update({ where: { id: scan.id }, data: { status: "CRAWLING" } });

    const result = await runScanPipeline(
      site.url,
      fromDbBusinessType(site.businessType),
      site.goal as BusinessGoal,
      limits.maxPagesScan
    );

    if (!result.ok) {
      await prisma.scan.update({
        where: { id: scan.id },
        data: { status: "FAILED", errorCode: result.errorCode, errorMessage: result.errorMessage },
      });
      return { ok: false, scanId: scan.id, errorMessage: result.errorMessage };
    }

    await prisma.scan.update({ where: { id: scan.id }, data: { status: "SCORING" } });

    const previousScan = await prisma.scan.findFirst({
      where: { siteId: site.id, status: "COMPLETED", id: { not: scan.id } },
      orderBy: { startedAt: "desc" },
    });

    const { report } = result;
    const geo = report.geo;

    // Priorita' sequenziale globale sulle raccomandazioni (tutte le
    // categorie insieme): coerente con l'ordinamento gia' applicato in
    // src/lib/analysis/action-plan.ts, cosi' priority riflette davvero
    // l'ordine di importanza e non solo l'ordine di categoria.
    const allRecommendations = report.analyses.flatMap((a) => a.recommendations);

    await prisma.$transaction([
      prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: "COMPLETED",
          overallScore: report.overallScore,
          pagesCrawled: result.crawl.pages.length,
          completedAt: new Date(),
          businessImpactSummary: report.businessImpactSummary,
          strengths: report.strengths,
          unverifiable: report.unverifiable,
          aiConversionAnalysis: report.aiAnalysis?.conversionAnalysis ?? null,
          aiContentAnalysis: report.aiAnalysis?.contentAnalysis ?? null,
          aiPriorities: report.aiAnalysis?.priorities ?? [],
          auditExecutiveSummary: report.businessImpactSummary,
          auditCrossAnalysis: report.crossAnalysis as unknown as Prisma.InputJsonValue,
          auditAiAvailable: report.aiInsightsAvailable,
          auditQuickWins: report.aiInsights?.quickWins ?? [],
          auditStrategicImprovements: report.aiInsights?.strategicImprovements ?? [],
          auditFinalAssessment: report.aiInsights?.finalAssessment || null,
        },
      }),
      prisma.scanScore.createMany({
        data: report.analyses.map((a) => ({
          scanId: scan.id,
          category: a.category,
          score: a.score,
          weight: report.masterScoreWeights[a.category] ?? 0,
          status: a.status,
          subScores: a.subScores as unknown as Prisma.InputJsonValue,
          notes: a.notes,
          dataAvailability: a.dataAvailability,
          shortSummary: a.shortSummary,
          metrics: a.metrics as unknown as Prisma.InputJsonValue,
          strengths: a.strengths,
        })),
      }),
      prisma.scanIssue.createMany({
        data: report.analyses.flatMap((a) =>
          a.findings.map((f) => ({
            scanId: scan.id,
            title: f.title,
            // description = impatto (area/effetto potenziale), whyItMatters
            // = spiegazione: mappatura 1:1 con Finding, cosi' la
            // ricostruzione (build-report-from-scan.ts) non perde il campo
            // impact duplicandolo con explanation.
            description: f.impact,
            whyItMatters: f.explanation,
            recommendation: a.recommendations.find((r) => r.title === f.title)?.action ?? f.impact,
            evidence: f.evidence,
            category: f.category,
            severity: toDbSeverity5(f.severity),
          }))
        ),
      }),
      prisma.recommendation.createMany({
        data: allRecommendations.map((rec, index) => ({
          scanId: scan.id,
          title: rec.title,
          detail: rec.action,
          priority: index + 1,
          category: rec.category,
          severity: toDbSeverity5(rec.severity),
          explanation: rec.explanation,
          impact: rec.impact,
          action: rec.action,
          evidence: rec.evidence,
        })),
      }),
      ...(geo
        ? [
            prisma.geoAnalysis.create({
              data: {
                scanId: scan.id,
                overallScore: geo.overallScore,
                localApplicable: geo.localApplicable,
                strengths: geo.strengths,
                entities: geo.entities as unknown as Prisma.InputJsonValue,
                informationCompleteness: geo.informationCompleteness as unknown as Prisma.InputJsonValue,
                answerabilityQueries: geo.answerabilityQueries as unknown as Prisma.InputJsonValue,
                aiSummary: geo.aiSummary,
                aiComparisonNote: geo.aiComparisonNote,
                shortSummary: report.geoShortSummary,
                categoryScores: {
                  createMany: {
                    data: geo.categoryScores.map((c) => ({
                      category: toDbGeoCategory(c.category),
                      score: c.score,
                      weight: c.weight,
                      applicable: c.applicable,
                      notes: c.notes,
                    })),
                  },
                },
                issues: {
                  createMany: {
                    data: geo.issues.map((issue) => ({
                      category: toDbGeoCategory(issue.category),
                      title: issue.title,
                      description: issue.description,
                      whyItMatters: issue.whyItMatters,
                      recommendation: issue.recommendation,
                      example: issue.example,
                      severity: toDbGeoSeverity(issue.severity),
                    })),
                  },
                },
              },
            }),
          ]
        : []),
    ]);

    if (site.monitoringEnabled) {
      const nextScanAt = new Date();
      nextScanAt.setDate(nextScanAt.getDate() + site.scanFrequencyDays);
      await prisma.site.update({ where: { id: site.id }, data: { nextScanAt } });
    }

    if (previousScan?.overallScore != null) {
      const delta = report.overallScore - previousScan.overallScore;
      if (Math.abs(delta) >= 3) {
        await prisma.notification.create({
          data: {
            userId: site.ownerId,
            siteId: site.id,
            type: "score_change",
            message: `Il Digital Score di ${site.url} e' passato da ${previousScan.overallScore} a ${report.overallScore}.`,
          },
        });
      }
    }

    const highSeverityCount = report.analyses.reduce(
      (sum, a) => sum + a.findings.filter((f) => f.severity === "critical" || f.severity === "high").length,
      0
    );
    if (highSeverityCount > 0) {
      await prisma.notification.create({
        data: {
          userId: site.ownerId,
          siteId: site.id,
          type: "issues_found",
          message: `Rilevati ${highSeverityCount} problemi ad alta priorita' su ${site.url}.`,
        },
      });
    }

    return { ok: true, scanId: scan.id };
  } catch (err) {
    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        status: "FAILED",
        errorCode: "PIPELINE_ERROR",
        errorMessage: err instanceof Error ? err.message : "Errore sconosciuto",
        retryCount: { increment: 1 },
      },
    });
    return { ok: false, scanId: scan.id, errorMessage: "Errore interno durante l'analisi." };
  }
}
