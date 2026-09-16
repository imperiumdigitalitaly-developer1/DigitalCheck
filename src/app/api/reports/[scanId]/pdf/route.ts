import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { buildReportFromScan } from "@/lib/pipeline/build-report-from-scan";
import { generateReportPdf } from "@/lib/pdf/report-pdf";

export const runtime = "nodejs";

export async function GET(request: NextRequest, props: { params: Promise<{ scanId: string }> }) {
  const params = await props.params;
  const slug = request.nextUrl.searchParams.get("slug");

  const scan = await prisma.scan.findUnique({
    where: { id: params.scanId },
    include: { site: true, reports: true },
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

  const report = await buildReportFromScan(params.scanId);
  if (!report) {
    return NextResponse.json({ error: "Il report non e' ancora disponibile per questo scan." }, { status: 409 });
  }

  const pdfBytes = await generateReportPdf(report);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="digitalcheck-report-${params.scanId}.pdf"`,
    },
  });
}
