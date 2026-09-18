import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSession } from "@/lib/auth/session";
import { getPlanFeatures } from "@/lib/billing/plan-config";
import { getUptimeRobotApiKey } from "@/lib/integrations/uptimerobot";
import { getMonitorSnapshotCached, provisionMonitorForSite } from "@/lib/gestionale/observability";

async function loadOwnedSite(siteId: string, userId: string) {
  const site = await prisma.site.findUnique({ where: { id: siteId }, include: { monitoringConfig: true } });
  if (!site || site.ownerId !== userId) return null;
  return site;
}

/**
 * Stato reale del monitor UptimeRobot di un sito (brief, punto 2): se il
 * sito non ha ancora un monitorId, o la chiave server non e' configurata,
 * risponde con lo stato onesto invece di dati finti — mai un uptime
 * inventato.
 */
export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!getPlanFeatures(user.plan).dashboard) {
    return NextResponse.json({ error: "Observability e' una funzionalita' del piano Pro." }, { status: 403 });
  }

  const siteId = request.nextUrl.searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ error: "siteId mancante" }, { status: 400 });

  const site = await loadOwnedSite(siteId, session.userId);
  if (!site) return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });

  const providerConfigured = getUptimeRobotApiKey() !== null;
  const monitorId = site.monitoringConfig?.monitorId ?? null;

  if (!monitorId) {
    return NextResponse.json({ providerConfigured, monitor: null, error: null });
  }

  const snapshot = await getMonitorSnapshotCached(monitorId);
  if (!snapshot.ok) {
    return NextResponse.json({ providerConfigured, monitor: null, error: snapshot.error });
  }

  return NextResponse.json({ providerConfigured, monitor: snapshot.monitor, error: null });
}

/**
 * Collega retroattivamente un monitor UptimeRobot a un sito che non ne ha
 * ancora uno (creato prima di questa funzionalita', o provisioning
 * fallito alla creazione del sito — brief, punto 3).
 */
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) return NextResponse.json({ error: "Non autenticato" }, { status: 401 });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!getPlanFeatures(user.plan).dashboard) {
    return NextResponse.json({ error: "Observability e' una funzionalita' del piano Pro." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const siteId = body?.siteId;
  if (!siteId || typeof siteId !== "string") {
    return NextResponse.json({ error: "siteId mancante" }, { status: 400 });
  }

  const site = await loadOwnedSite(siteId, session.userId);
  if (!site) return NextResponse.json({ error: "Sito non trovato" }, { status: 404 });

  if (!getUptimeRobotApiKey()) {
    return NextResponse.json({ error: "UPTIMEROBOT_API_KEY non configurata lato server." }, { status: 503 });
  }

  if (site.monitoringConfig?.monitorId) {
    return NextResponse.json({ error: "Questo sito ha gia' un monitor collegato." }, { status: 409 });
  }

  const result = await provisionMonitorForSite(site.id, site.url);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, monitorId: result.monitorId });
}
