import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { buildReportFromScan } from "@/lib/pipeline/build-report-from-scan";
import { toFreeReport } from "@/lib/billing/report-tiering";
import { getPlanFeatures } from "@/lib/billing/plan-config";

export const runtime = "nodejs";

/**
 * Report completo (ricostruito dal DB) per uno scan specifico gia'
 * eseguito — usato dalla pagina di dettaglio sito per mostrare
 * ReportView anche per gli scan storici, non solo per lo scan appena
 * eseguito. Il troncamento Free avviene qui lato server, come per
 * /api/sites/:id/scan.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; scanId: string } }
) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const scan = await prisma.scan.findUnique({
    where: { id: params.scanId },
    include: { site: true },
  });
  if (!scan || scan.siteId !== params.id || scan.site.ownerId !== session.userId) {
    return NextResponse.json({ error: "Scan non trovato" }, { status: 404 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const fullReport = await buildReportFromScan(scan.id);
  if (!fullReport) {
    return NextResponse.json({ error: "Il report non e' ancora disponibile per questo scan." }, { status: 409 });
  }

  const report = getPlanFeatures(user.plan).fullReports ? fullReport : toFreeReport(fullReport);
  return NextResponse.json({ report, plan: user.plan });
}
