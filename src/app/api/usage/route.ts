import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import {
  getPlanLimits,
  countScansThisMonth,
  countScansThisWeek,
  countSites,
  countSitesThisMonth,
} from "@/lib/billing/plan-limits";
import { getPlanFeatures } from "@/lib/billing/plan-config";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const limits = await getPlanLimits(user.plan);
  const features = getPlanFeatures(user.plan);

  const [scansThisMonth, scansThisWeek, sitesTotal, sitesThisMonth] = await Promise.all([
    countScansThisMonth(session.userId),
    countScansThisWeek(session.userId),
    countSites(session.userId),
    countSitesThisMonth(session.userId),
  ]);

  return NextResponse.json({
    plan: user.plan,
    features,
    scans: {
      thisMonth: scansThisMonth,
      thisWeek: scansThisWeek,
      maxMonth: limits.maxScansMonth,
      maxWeek: limits.maxScansWeek,
    },
    sites: {
      total: sitesTotal,
      thisMonth: sitesThisMonth,
      maxMonth: limits.maxSitesMonth,
      unlimited: user.plan === "PRO",
    },
  });
}
