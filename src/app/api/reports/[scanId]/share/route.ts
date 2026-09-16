import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";

export async function POST(request: NextRequest, props: { params: Promise<{ scanId: string }> }) {
  const params = await props.params;
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const scan = await prisma.scan.findUnique({
    where: { id: params.scanId },
    include: { site: true, reports: true },
  });

  if (!scan || scan.site.ownerId !== session.userId) {
    return NextResponse.json({ error: "Scan non trovato" }, { status: 404 });
  }
  if (scan.status !== "COMPLETED") {
    return NextResponse.json({ error: "Lo scan non e' ancora completato" }, { status: 409 });
  }

  const existing = scan.reports[0];
  const publicSlug = existing?.publicSlug ?? randomBytes(12).toString("hex");

  if (!existing) {
    await prisma.report.create({ data: { scanId: scan.id, publicSlug } });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  return NextResponse.json({
    pdfUrl: `${appUrl}/api/reports/${scan.id}/pdf?slug=${publicSlug}`,
  });
}
