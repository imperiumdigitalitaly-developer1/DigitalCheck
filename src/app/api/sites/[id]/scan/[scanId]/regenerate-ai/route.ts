import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { buildReportFromScan } from "@/lib/pipeline/build-report-from-scan";
import { runAuditAiAnalysis } from "@/lib/ai/audit-analyzer";
import { aiErrorClientMessage, aiErrorHttpStatus } from "@/lib/ai/errors";
import { getPlanFeatures } from "@/lib/billing/plan-config";
import { STATUS_LABEL, scoreToStatus } from "@/lib/analysis/constants";

export const runtime = "nodejs";
// Stesso tetto delle altre route che chiamano Gemini con retry su 503/timeout.
export const maxDuration = 90;

// Lock in-memory per istanza: evita che un doppio click o due richieste
// quasi simultanee sullo stesso scan richiamino Gemini due volte (gestione
// errori AI e cache analisi, punto B — "proteggi da doppi click e da
// richieste parallele"). Non protegge da istanze serverless diverse in
// corsa esatta, ma quel caso e' irrilevante per un pulsante azionato a
// mano da un singolo utente. Il controllo su auditAiAvailable=false, sia
// in lettura che nella updateMany finale, resta la garanzia di correttezza
// sui dati anche se il lock non basta.
const regenerating = new Set<string>();

export async function POST(request: NextRequest, { params }: { params: { id: string; scanId: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!getPlanFeatures(user.plan).ai) {
    return NextResponse.json({ error: "Questa funzione e' disponibile con il piano Pro." }, { status: 403 });
  }

  const scan = await prisma.scan.findUnique({ where: { id: params.scanId }, include: { site: true } });
  if (!scan || scan.siteId !== params.id || scan.site.ownerId !== session.userId) {
    return NextResponse.json({ error: "Scan non trovato" }, { status: 404 });
  }
  if (scan.status !== "COMPLETED") {
    return NextResponse.json({ error: "Lo scan non e' completato." }, { status: 409 });
  }

  // Gia' disponibile (rigenerata da un'altra richiesta, o mai stata
  // effettivamente mancante): nessuna chiamata a Gemini, mai per un dato
  // che c'e' gia' (stesso principio del riuso della cache di report/PDF).
  if (scan.auditAiAvailable) {
    return NextResponse.json({ ok: true, alreadyAvailable: true });
  }

  if (regenerating.has(params.scanId)) {
    return NextResponse.json({ error: "Rigenerazione gia' in corso per questa scansione." }, { status: 409 });
  }
  regenerating.add(params.scanId);

  try {
    const report = await buildReportFromScan(params.scanId);
    if (!report) {
      return NextResponse.json({ error: "Dati dello scan non disponibili." }, { status: 409 });
    }

    const auditAi = await runAuditAiAnalysis(
      report.analyses,
      report.geo?.overallScore ?? null,
      report.geo?.issues ?? [],
      report.overallScore,
      report.crossAnalysis.map((c) => c.pairLabel),
      report.businessType,
      report.goal
    );

    if (!auditAi.executiveSummary) {
      const kind = auditAi.errorKind ?? "unknown";
      return NextResponse.json({ error: aiErrorClientMessage(kind), code: kind }, { status: aiErrorHttpStatus(kind) });
    }

    const strengths = auditAi.mainStrengths.length > 0 ? auditAi.mainStrengths : report.analyses.flatMap((a) => a.strengths).slice(0, 6);
    const businessImpactSummary =
      auditAi.executiveSummary ??
      `DigitalCheck Score complessivo: ${report.overallScore}/100 (${STATUS_LABEL[scoreToStatus(report.overallScore)]}).`;
    const crossAnalysisWithAiNotes = report.crossAnalysis.map((c) => ({
      ...c,
      note: auditAi.crossAnalysisNotes[c.pairLabel] ?? c.note,
    }));

    // Guard finale: scrive solo se nel frattempo nessun'altra richiesta ha
    // gia' portato auditAiAvailable a true (vedi commento sul lock sopra).
    await prisma.scan.updateMany({
      where: { id: params.scanId, auditAiAvailable: false },
      data: {
        businessImpactSummary,
        strengths,
        auditExecutiveSummary: auditAi.executiveSummary,
        auditCrossAnalysis: crossAnalysisWithAiNotes as unknown as Prisma.InputJsonValue,
        auditAiAvailable: true,
        auditQuickWins: auditAi.quickWins,
        auditStrategicImprovements: auditAi.strategicImprovements,
        auditFinalAssessment: auditAi.finalAssessment || null,
      },
    });

    return NextResponse.json({ ok: true });
  } finally {
    regenerating.delete(params.scanId);
  }
}
