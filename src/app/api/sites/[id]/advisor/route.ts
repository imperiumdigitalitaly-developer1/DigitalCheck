import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { buildReportFromScan } from "@/lib/pipeline/build-report-from-scan";
import { askAdvisor } from "@/lib/ai/advisor";

export const runtime = "nodejs";

const schema = z.object({ question: z.string().trim().min(1).max(500) });

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (user.plan !== "PRO") {
    return NextResponse.json(
      { error: "L'assistente AI e' una funzionalita' del piano Pro." },
      { status: 403 }
    );
  }

  const site = await prisma.site.findUnique({
    where: { id: params.id },
    include: { scans: { where: { status: "COMPLETED" }, orderBy: { startedAt: "desc" }, take: 1 } },
  });
  if (!site || site.ownerId !== session.userId) {
    return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });
  }

  const latestScan = site.scans[0];
  if (!latestScan) {
    return NextResponse.json(
      { error: "Esegui prima una scansione: l'assistente ha bisogno di dati reali del sito per rispondere." },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Scrivi una domanda prima di inviare." }, { status: 400 });
  }

  const report = await buildReportFromScan(latestScan.id);
  if (!report) {
    return NextResponse.json({ error: "Dati dello scan non disponibili." }, { status: 409 });
  }

  const result = await askAdvisor(parsed.data.question, report);
  if (!result.answer) {
    return NextResponse.json({ error: result.unavailableReason ?? "Assistente non disponibile." }, { status: 503 });
  }

  return NextResponse.json({ answer: result.answer });
}
