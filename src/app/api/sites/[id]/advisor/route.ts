import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { buildReportFromScan } from "@/lib/pipeline/build-report-from-scan";
import { askAdvisor } from "@/lib/ai/advisor";
import { getPlanFeatures } from "@/lib/billing/plan-config";

export const runtime = "nodejs";

const schema = z.object({ question: z.string().trim().min(1).max(500) });

async function getOrCreateConversation(siteId: string, userId: string) {
  const existing = await prisma.aIConversation.findFirst({
    where: { siteId, userId },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;
  return prisma.aIConversation.create({ data: { siteId, userId } });
}

/** Storico della conversazione con l'assistente per questo sito (Pro). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!getPlanFeatures(user.plan).ai) {
    return NextResponse.json({ error: "L'assistente AI e' una funzionalita' del piano Pro." }, { status: 403 });
  }

  const site = await prisma.site.findUnique({ where: { id: params.id } });
  if (!site || site.ownerId !== session.userId) {
    return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });
  }

  const conversation = await prisma.aIConversation.findFirst({
    where: { siteId: params.id, userId: session.userId },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({
    messages: conversation?.messages.map((m) => ({ role: m.role, text: m.text })) ?? [],
  });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!getPlanFeatures(user.plan).ai) {
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

  // Storico persistito (brief sezione 13/23): permette all'assistente di
  // restare disponibile tra un refresh e l'altro invece di perdere il
  // contesto della conversazione a ogni ricarica della pagina.
  const conversation = await getOrCreateConversation(params.id, session.userId);
  await prisma.aIConversation.update({
    where: { id: conversation.id },
    data: {
      messages: {
        createMany: {
          data: [
            { role: "user", text: parsed.data.question },
            { role: "assistant", text: result.answer },
          ],
        },
      },
    },
  });

  return NextResponse.json({ answer: result.answer });
}
