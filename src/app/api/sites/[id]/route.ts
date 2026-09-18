import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { fromDbBusinessType } from "@/lib/db/enum-map";
import { deprovisionMonitorForSite } from "@/lib/gestionale/observability";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const site = await prisma.site.findUnique({
    where: { id: params.id },
    include: {
      scans: {
        orderBy: { startedAt: "desc" },
        take: 20,
        include: { scores: true, issues: true },
      },
    },
  });

  // 404 (non 403) quando il sito esiste ma non e' dell'utente: non
  // confermiamo l'esistenza di un ID che non gli appartiene.
  if (!site || site.ownerId !== session.userId) {
    return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });
  }

  return NextResponse.json({
    id: site.id,
    url: site.url,
    businessType: fromDbBusinessType(site.businessType),
    goal: site.goal,
    monitoringEnabled: site.monitoringEnabled,
    scanFrequencyDays: site.scanFrequencyDays,
    nextScanAt: site.nextScanAt,
    scans: site.scans.map((scan) => ({
      id: scan.id,
      status: scan.status,
      overallScore: scan.overallScore,
      pagesCrawled: scan.pagesCrawled,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      errorMessage: scan.errorMessage,
      categoryScores: scan.scores.map((s) => ({ category: s.category, score: s.score, weight: s.weight })),
      issueCount: scan.issues.length,
      highSeverityCount: scan.issues.filter((i) => i.severity === "HIGH").length,
    })),
  });
}

const patchSchema = z.object({
  monitoringEnabled: z.boolean().optional(),
  scanFrequencyDays: z.number().int().min(1).max(90).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const site = await prisma.site.findUnique({ where: { id: params.id } });
  if (!site || site.ownerId !== session.userId) {
    return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  if (parsed.data.monitoringEnabled) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
    if (user.plan !== "PRO") {
      return NextResponse.json(
        { error: "Il monitoraggio periodico e' una funzionalita' del piano Pro." },
        { status: 403 }
      );
    }
  }

  const nextScanAt =
    parsed.data.monitoringEnabled && !site.monitoringEnabled
      ? new Date(Date.now() + (parsed.data.scanFrequencyDays ?? site.scanFrequencyDays) * 24 * 60 * 60 * 1000)
      : parsed.data.monitoringEnabled === false
        ? null
        : undefined;

  const updated = await prisma.site.update({
    where: { id: params.id },
    data: { ...parsed.data, ...(nextScanAt !== undefined ? { nextScanAt } : {}) },
  });

  return NextResponse.json({
    monitoringEnabled: updated.monitoringEnabled,
    scanFrequencyDays: updated.scanFrequencyDays,
    nextScanAt: updated.nextScanAt,
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const site = await prisma.site.findUnique({ where: { id: params.id }, include: { monitoringConfig: true } });
  if (!site || site.ownerId !== session.userId) {
    return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });
  }

  // Va eliminato PRIMA del sito: onDelete: Cascade rimuove comunque la riga
  // MonitoringConfig dal nostro DB, ma non tocca UptimeRobot — senza questa
  // chiamata il monitor resterebbe orfano e continuerebbe a consumare la
  // quota dell'account (brief, punto 4).
  if (site.monitoringConfig?.monitorId) {
    await deprovisionMonitorForSite(site.monitoringConfig.monitorId);
  }

  await prisma.site.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
