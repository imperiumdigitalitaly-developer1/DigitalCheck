import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { getPlanFeatures } from "@/lib/billing/plan-config";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!getPlanFeatures(user.plan).dashboard) {
    return NextResponse.json({ error: "Il Gestionale e' una funzionalita' del piano Pro." }, { status: 403 });
  }

  const sites = await prisma.site.findMany({
    where: { ownerId: session.userId },
    include: {
      scans: {
        where: { status: "COMPLETED" },
        orderBy: { startedAt: "desc" },
        take: 1,
        include: { issues: true },
      },
    },
  });

  const scoredSites = sites.filter((s) => s.scans[0]?.overallScore != null);
  const avgScore =
    scoredSites.length > 0
      ? Math.round(scoredSites.reduce((sum, s) => sum + (s.scans[0]?.overallScore ?? 0), 0) / scoredSites.length)
      : null;

  const recentScans = sites
    .filter((s) => s.scans[0])
    .map((s) => ({
      siteId: s.id,
      url: s.url,
      score: s.scans[0]?.overallScore ?? null,
      date: s.scans[0]?.startedAt ?? null,
    }))
    .sort((a, b) => (b.date && a.date ? new Date(b.date).getTime() - new Date(a.date).getTime() : 0))
    .slice(0, 5);

  // Problemi ricorrenti: conteggio reale di titoli identici tra le
  // ultime scansioni completate — nessuna causalita' inventata, solo
  // frequenza osservata.
  const titleCounts = new Map<string, number>();
  for (const site of sites) {
    for (const issue of site.scans[0]?.issues ?? []) {
      titleCounts.set(issue.title, (titleCounts.get(issue.title) ?? 0) + 1);
    }
  }
  const recurringIssues = [...titleCounts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([title, count]) => ({ title, siteCount: count }));

  const alerts = await prisma.notification.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return NextResponse.json({
    totalSites: sites.length,
    avgScore,
    recentScans,
    recurringIssues,
    alerts: alerts.map((a) => ({ id: a.id, type: a.type, message: a.message, createdAt: a.createdAt, read: a.read })),
  });
}
