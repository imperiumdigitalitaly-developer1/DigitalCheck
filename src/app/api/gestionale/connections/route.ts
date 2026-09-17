import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { getPlanFeatures } from "@/lib/billing/plan-config";

/**
 * Stato reale delle integrazioni esterne per un sito (Google Analytics,
 * Search Console, monitoring/uptime). Nessuna di queste e' configurabile
 * in questo ambiente (richiede OAuth/credenziali esterne — vedi
 * .env.example): l'endpoint riflette sempre lo stato vero salvato su DB,
 * mai un valore finto "connesso".
 */
export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!getPlanFeatures(user.plan).dashboard) {
    return NextResponse.json({ error: "Funzionalita' del piano Pro." }, { status: 403 });
  }

  const siteId = request.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ error: "siteId mancante" }, { status: 400 });

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { analyticsConnection: true, searchConsoleConnection: true, monitoringConfig: true },
  });
  if (!site || site.ownerId !== session.userId) {
    return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });
  }

  return NextResponse.json({
    analytics: { connected: site.analyticsConnection?.connected ?? false },
    searchConsole: { connected: site.searchConsoleConnection?.connected ?? false },
    monitoring: { configured: site.monitoringConfig?.configured ?? false },
  });
}
