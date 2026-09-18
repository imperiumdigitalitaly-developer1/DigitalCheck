import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { buildReportFromScan } from "@/lib/pipeline/build-report-from-scan";
import { generateReportPdf } from "@/lib/pdf/report-pdf";
import { toFreeReport } from "@/lib/billing/report-tiering";
import { getPlanFeatures } from "@/lib/billing/plan-config";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: { scanId: string } }) {
  const slug = request.nextUrl.searchParams.get("slug");

  const scan = await prisma.scan.findUnique({
    where: { id: params.scanId },
    include: { site: { include: { owner: true } }, reports: true },
  });
  if (!scan) return NextResponse.json({ error: "Scan non trovato" }, { status: 404 });

  let authorized = false;

  if (slug) {
    authorized = scan.reports.some((r) => r.publicSlug === slug);
  } else {
    const session = await getCurrentSession();
    authorized = !!session && session.userId === scan.site.ownerId;
  }

  if (!authorized) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  const fullReport = await buildReportFromScan(params.scanId);
  if (!fullReport) {
    return NextResponse.json({ error: "Il report non e' ancora disponibile per questo scan." }, { status: 409 });
  }

  // Il PDF segue sempre il piano del proprietario del sito: 1 pagina
  // sintetica per Free, report completo per Pro (brief sezioni 4 e 15) —
  // anche quando servito tramite link pubblico condiviso.
  const ownerPlan = scan.site.owner.plan;
  const report = getPlanFeatures(ownerPlan).fullReports ? fullReport : toFreeReport(fullReport);
  const pdfBytes = await generateReportPdf(report, ownerPlan);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="digitalcheck-report-${params.scanId}.pdf"`,
    },
  });
}
