import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { getPlanFeatures } from "@/lib/billing/plan-config";
import { loadSearchConsolePanel, selectSearchConsoleProperty } from "@/lib/gestionale/search-console";

async function loadOwnedSite(siteId: string, userId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site || site.ownerId !== userId) return null;
  return site;
}

/**
 * Stato reale della connessione Search Console per un sito: se manca la
 * proprieta' restituisce l'elenco di quelle disponibili da scegliere, se
 * e' gia' scelta restituisce i dati reali (searchanalytics.query) — mai
 * numeri finti (brief, integrazione Search Console).
 */
export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!getPlanFeatures(user.plan).dashboard) {
    return NextResponse.json({ error: "Search Console e' una funzionalita' del piano Pro." }, { status: 403 });
  }

  const siteId = request.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ error: "siteId mancante" }, { status: 400 });

  const site = await loadOwnedSite(siteId, session.userId);
  if (!site) return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });

  const panel = await loadSearchConsolePanel(siteId, {
    forceSelection: request.nextUrl.searchParams.get("select") === "1",
  });
  return NextResponse.json(panel);
}

/** Salva la proprieta' Search Console scelta dall'utente tra quelle disponibili sul suo account. */
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!getPlanFeatures(user.plan).dashboard) {
    return NextResponse.json({ error: "Search Console e' una funzionalita' del piano Pro." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const siteId = body?.siteId;
  const propertySiteUrl = body?.siteUrl;
  if (!siteId || typeof siteId !== "string" || !propertySiteUrl || typeof propertySiteUrl !== "string") {
    return NextResponse.json({ error: "siteId o siteUrl mancante" }, { status: 400 });
  }

  const site = await loadOwnedSite(siteId, session.userId);
  if (!site) return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });

  const connection = await prisma.searchConsoleConnection.findUnique({ where: { siteId } });
  if (!connection?.connected) {
    return NextResponse.json({ error: "Search Console non e' collegata per questo sito." }, { status: 409 });
  }

  const result = await selectSearchConsoleProperty(siteId, propertySiteUrl);
  if (!result.ok) {
    return NextResponse.json({ error: result.error, reauthRequired: result.reauthRequired }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
