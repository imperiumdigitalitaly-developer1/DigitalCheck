import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { getPlanLimits, countScansThisMonth } from "@/lib/billing/plan-limits";
import { persistScanForSite } from "@/lib/pipeline/persist-scan";
import { buildReportFromScan } from "@/lib/pipeline/build-report-from-scan";

export const runtime = "nodejs";

/**
 * Avvia un nuovo scan per un sito gia' registrato dall'utente autenticato
 * e lo persiste (Scan, ScanScore, ScanIssue, Recommendation). Controparte
 * autenticata di /api/scan, che invece resta stateless per il widget
 * pubblico della landing page.
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const site = await prisma.site.findUnique({ where: { id: params.id } });
  if (!site || site.ownerId !== session.userId) {
    return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const limits = await getPlanLimits(user.plan);
  const scansThisMonth = await countScansThisMonth(session.userId);
  if (scansThisMonth >= limits.maxScansMonth) {
    return NextResponse.json(
      { error: `Hai raggiunto il limite di ${limits.maxScansMonth} scansioni mensili per il piano ${user.plan}.` },
      { status: 403 }
    );
  }

  const result = await persistScanForSite(site, user);
  if (!result.ok) {
    return NextResponse.json({ error: result.errorMessage ?? "Scan fallito" }, { status: 422 });
  }

  const report = await buildReportFromScan(result.scanId);
  return NextResponse.json({ scanId: result.scanId, report });
}
