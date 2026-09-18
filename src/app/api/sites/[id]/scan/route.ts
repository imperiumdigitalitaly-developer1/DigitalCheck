import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { getPlanLimits, countScansThisMonth, countScansThisWeek } from "@/lib/billing/plan-limits";
import { persistScanForSite } from "@/lib/pipeline/persist-scan";
import { buildReportFromScan } from "@/lib/pipeline/build-report-from-scan";
import { toFreeReport } from "@/lib/billing/report-tiering";
import { getPlanFeatures } from "@/lib/billing/plan-config";

export const runtime = "nodejs";

/**
 * Avvia un nuovo scan per un sito gia' registrato dall'utente autenticato
 * e lo persiste (Scan, ScanScore, ScanIssue, Recommendation). Controparte
 * autenticata di /api/scan, che invece resta stateless per il widget
 * pubblico della landing page.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const site = await prisma.site.findUnique({ where: { id: params.id } });
  if (!site || site.ownerId !== session.userId) {
    return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const limits = await getPlanLimits(user.plan);

  if (user.plan === "FREE") {
    const scansThisWeek = await countScansThisWeek(session.userId);
    const cap = limits.maxScansWeek ?? 1;
    if (scansThisWeek >= cap) {
      return NextResponse.json(
        {
          error: `Con il piano Free puoi eseguire ${cap} analisi a settimana. Passa a Pro per analisi illimitate (fino a 200/mese).`,
          errorCode: "FREE_SCANS_WEEK_LIMIT",
        },
        { status: 403 }
      );
    }
  } else {
    const scansThisMonth = await countScansThisMonth(session.userId);
    if (scansThisMonth >= limits.maxScansMonth) {
      return NextResponse.json(
        {
          error: `Hai raggiunto il limite di ${limits.maxScansMonth} analisi mensili. Il limite si rinnova al prossimo rinnovo del piano.`,
          errorCode: "PRO_SCANS_MONTH_LIMIT",
        },
        { status: 403 }
      );
    }
  }

  const result = await persistScanForSite(site, user);
  if (!result.ok) {
    return NextResponse.json({ error: result.errorMessage ?? "Scan fallito" }, { status: 422 });
  }

  const fullReport = await buildReportFromScan(result.scanId);
  // Un utente Free non deve poter ottenere il report completo anche
  // chiamando questa API direttamente: il troncamento avviene qui, non
  // solo nell'interfaccia (vedi brief sezione 30).
  const report = fullReport && !getPlanFeatures(user.plan).fullReports ? toFreeReport(fullReport) : fullReport;
  return NextResponse.json({ scanId: result.scanId, report, plan: user.plan });
}
