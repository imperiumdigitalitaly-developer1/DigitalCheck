import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { persistScanForSite } from "@/lib/pipeline/persist-scan";
import { retryPendingMonitorCleanups } from "@/lib/gestionale/site-teardown";

export const runtime = "nodejs";
export const maxDuration = 300; // scan multipli possono richiedere tempo

/**
 * GET cosi' e' compatibile con Vercel Cron (che chiama sempre GET) — vedi
 * vercel.json. Protetto da CRON_SECRET nell'header Authorization: senza
 * corrispondenza esatta la richiesta viene rifiutata, per evitare che
 * chiunque possa forzare scansioni massive a piacere.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET non configurato" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  // Riprova a eliminare da UptimeRobot i monitor di siti gia' eliminati che
  // non era stato possibile ripulire subito. Mai bloccante per le scansioni.
  const monitorCleanup = await retryPendingMonitorCleanups().catch((err) => {
    console.error("[cron] pulizia monitor non riuscita:", err instanceof Error ? err.message : err);
    return null;
  });

  const dueSites = await prisma.site.findMany({
    where: { monitoringEnabled: true, nextScanAt: { lte: new Date() } },
    include: { owner: true },
    // Limite di sicurezza per invocazione: se ce ne sono di piu' in coda,
    // li prendera' l'invocazione successiva del cron.
    take: 25,
  });

  const results: { siteId: string; ok: boolean }[] = [];
  for (const site of dueSites) {
    const result = await persistScanForSite(site, site.owner);
    results.push({ siteId: site.id, ok: result.ok });
  }

  return NextResponse.json({ processed: results.length, results, monitorCleanup });
}
