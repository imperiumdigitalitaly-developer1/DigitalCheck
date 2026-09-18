import { prisma } from "@/lib/db/prisma";
import { createMonitor, deleteMonitor, getMonitorSnapshot, type MonitorSnapshot } from "@/lib/integrations/uptimerobot";

const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Cache in-memory per evitare di richiamare getMonitors a ogni apertura
 * della tab Observability (l'account UptimeRobot ha un limite di
 * richieste/minuto). Vive nel processo Node del singolo lambda/istanza
 * Next.js: su Vercel non e' condivisa tra istanze e si resetta a ogni
 * cold start — un limite accettato (non serve una cache distribuita per
 * un dato che comunque UptimeRobot aggiorna al massimo ogni 5 minuti).
 */
const cache = new Map<string, { expiresAt: number; result: Awaited<ReturnType<typeof getMonitorSnapshot>> }>();

export async function getMonitorSnapshotCached(
  monitorId: string
): Promise<{ ok: true; monitor: MonitorSnapshot } | { ok: false; error: string }> {
  const cached = cache.get(monitorId);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const result = await getMonitorSnapshot(monitorId);
  // Non mettiamo in cache un errore transitorio (es. timeout di rete): un
  // fallimento non deve "congelarsi" per 5 minuti se il prossimo tentativo
  // potrebbe riuscire.
  if (result.ok) cache.set(monitorId, { expiresAt: Date.now() + CACHE_TTL_MS, result });
  return result;
}

/**
 * Crea il monitor su UptimeRobot per un sito e salva l'ID restituito.
 * Usata sia alla creazione automatica del sito (piano Pro) sia dal
 * pulsante "Configura monitoring" per collegarlo retroattivamente. Non
 * lancia mai: un fallimento (rete, quota, chiave assente) va gestito dal
 * chiamante mostrando lo stato onesto, non bloccando l'operazione che lo
 * ha innescato.
 */
export async function provisionMonitorForSite(
  siteId: string,
  url: string
): Promise<{ ok: true; monitorId: string } | { ok: false; error: string }> {
  const result = await createMonitor(url, `DigitalCheck — ${url}`);
  if (!result.ok) return result;

  await prisma.monitoringConfig.upsert({
    where: { siteId },
    create: { siteId, configured: true, provider: "uptimerobot", checkUrl: url, monitorId: result.monitorId },
    update: { configured: true, provider: "uptimerobot", checkUrl: url, monitorId: result.monitorId },
  });

  return result;
}

/**
 * Elimina il monitor corrispondente su UptimeRobot prima che il sito
 * (e la sua MonitoringConfig, via cascade) vengano rimossi dal DB —
 * altrimenti il monitor resterebbe orfano e continuerebbe a consumare la
 * quota dell'account UptimeRobot. Best-effort: un fallimento viene
 * loggato ma non deve impedire l'eliminazione del sito, che l'utente ha
 * gia' richiesto esplicitamente.
 */
export async function deprovisionMonitorForSite(monitorId: string): Promise<void> {
  const result = await deleteMonitor(monitorId);
  if (!result.ok) {
    console.error(`[observability] impossibile eliminare il monitor UptimeRobot ${monitorId}: ${result.error}`);
  }
}
