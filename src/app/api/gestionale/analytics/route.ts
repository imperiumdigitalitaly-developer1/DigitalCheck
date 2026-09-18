import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { getPlanFeatures } from "@/lib/billing/plan-config";
import { loadAnalyticsPanel, selectAnalyticsProperty } from "@/lib/gestionale/analytics";

async function loadOwnedSite(siteId: string, userId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site || site.ownerId !== userId) return null;
  return site;
}

/**
 * Stato reale della connessione Google Analytics per un sito: se manca la
 * proprieta' restituisce l'elenco di quelle disponibili da scegliere, se
 * e' gia' scelta restituisce i dati reali (runReport) — mai numeri finti
 * (brief, integrazione Analytics).
 */
export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!getPlanFeatures(user.plan).dashboard) {
    return NextResponse.json({ error: "Web Analytics e' una funzionalita' del piano Pro." }, { status: 403 });
  }

  const siteId = request.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ error: "siteId mancante" }, { status: 400 });

  const site = await loadOwnedSite(siteId, session.userId);
  if (!site) return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });

  const panel = await loadAnalyticsPanel(siteId, {
    forceSelection: request.nextUrl.searchParams.get("select") === "1",
  });
  return NextResponse.json(panel);
}

/** Salva la proprieta' GA4 scelta dall'utente tra quelle disponibili sul suo account. */
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!getPlanFeatures(user.plan).dashboard) {
    return NextResponse.json({ error: "Web Analytics e' una funzionalita' del piano Pro." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const siteId = body?.siteId;
  const propertyId = body?.propertyId;
  if (!siteId || typeof siteId !== "string" || !propertyId || typeof propertyId !== "string") {
    return NextResponse.json({ error: "siteId o propertyId mancante" }, { status: 400 });
  }

  const site = await loadOwnedSite(siteId, session.userId);
  if (!site) return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });

  const connection = await prisma.analyticsConnection.findUnique({ where: { siteId } });
  if (!connection?.connected) {
    return NextResponse.json({ error: "Google Analytics non e' collegato per questo sito." }, { status: 409 });
  }

  const result = await selectAnalyticsProperty(siteId, propertyId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, reauthRequired: result.reauthRequired }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
