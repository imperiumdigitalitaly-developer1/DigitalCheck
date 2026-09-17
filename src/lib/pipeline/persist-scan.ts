import { prisma } from "@/lib/db/prisma";
import { runScanPipeline } from "@/lib/pipeline/run-scan";
import { fromDbBusinessType, toDbSeverity } from "@/lib/db/enum-map";
import { getPlanLimits } from "@/lib/billing/plan-limits";
import type { BusinessGoal } from "@/types";
import type { Site, User } from "@prisma/client";

export interface PersistScanResult {
  ok: boolean;
  scanId: string;
  errorMessage?: string;
}

export async function persistScanForSite(site: Site, owner: User): Promise<PersistScanResult> {
  const limits = await getPlanLimits(owner.plan);

  const scan = await prisma.scan.create({ data: { siteId: site.id, status: "REQUESTED" } });

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

    await prisma.$transaction([
      prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: "COMPLETED",
          overallScore: result.report.overallScore,
          pagesCrawled: result.crawl.pages.length,
          completedAt: new Date(),
          businessImpactSummary: result.report.businessImpactSummary,
          strengths: result.report.strengths,
          unverifiable: result.report.unverifiable,
          aiConversionAnalysis: result.report.aiAnalysis?.conversionAnalysis ?? null,
          aiContentAnalysis: result.report.aiAnalysis?.contentAnalysis ?? null,
          aiPriorities: result.report.aiAnalysis?.priorities ?? [],
        },
      }),
      prisma.scanScore.createMany({
        data: result.scoring.categoryScores.map((c) => ({
          scanId: scan.id,
          category: c.category,
          score: c.score,
          weight: c.weight,
        })),
      }),
      prisma.scanIssue.createMany({
        data: result.report.issues.map((issue) => ({
          scanId: scan.id,
          title: issue.title,
          description: issue.description,
          whyItMatters: issue.whyItMatters,
          recommendation: issue.recommendation,
          evidence: issue.evidence,
          category: issue.category,
          severity: toDbSeverity(issue.severity),
        })),
      }),
      prisma.recommendation.createMany({
        data: result.report.recommendedActions.map((action, index) => ({
          scanId: scan.id,
          title: action,
          detail: action,
          priority: index + 1,
        })),
      }),
    ]);

    if (site.monitoringEnabled) {
      const nextScanAt = new Date();
      nextScanAt.setDate(nextScanAt.getDate() + site.scanFrequencyDays);
      await prisma.site.update({ where: { id: site.id }, data: { nextScanAt } });
    }

    if (previousScan?.overallScore != null) {
      const delta = result.report.overallScore - previousScan.overallScore;
      if (Math.abs(delta) >= 3) {
        await prisma.notification.create({
          data: {
            userId: site.ownerId,
            type: "score_change",
            message: `Il Digital Score di ${site.url} e' passato da ${previousScan.overallScore} a ${result.report.overallScore}.`,
          },
        });
      }
    }

    const highSeverityCount = result.report.issues.filter((i) => i.severity === "high").length;
    if (highSeverityCount > 0) {
      await prisma.notification.create({
        data: {
          userId: site.ownerId,
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
