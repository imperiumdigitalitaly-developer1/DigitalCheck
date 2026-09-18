import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { deleteMonitor } from "@/lib/integrations/uptimerobot";
import { revokeGoogleToken, type GoogleOAuthProvider } from "@/lib/integrations/google-oauth";

/**
 * Eliminazione di un sito (o di tutti i siti di un utente) con pulizia di cio'
 * che vive FUORI dal nostro database e che la cascade non puo' raggiungere:
 * - monitor UptimeRobot: l'ID viene messo in coda (MonitorCleanup) nella STESSA
 *   transazione dell'eliminazione, poi si prova subito a eliminarlo. Se il
 *   provider non risponde l'utente non viene bloccato: la riga resta in coda e
 *   il cron giornaliero riprova (retryPendingMonitorCleanups);
 * - grant OAuth Google (Analytics/Search Console): revocati, best effort.
 */

const MAX_CLEANUP_ATTEMPTS = 10;
// Oltre questo tempo non si attende oltre il provider: la risposta all'utente
// non deve dipendere da un servizio esterno lento. Cio' che non e' finito
// resta in coda per il cron.
const EXTERNAL_CLEANUP_TIMEOUT_MS = 15_000;

export interface ExternalTeardownPlan {
  monitorIds: string[];
  googleTokens: { provider: GoogleOAuthProvider; token: string }[];
}

/**
 * Legge, PRIMA dell'eliminazione, cio' che dovra' essere ripulito all'esterno
 * (dopo la cascade non sarebbe piu' recuperabile).
 *
 * Google: la revoca chiude l'intero grant dell'account Google per quell'app,
 * quindi se lo stesso proprietario ha ancora un altro sito collegato allo
 * stesso servizio non si revoca (romperebbe quella connessione, che
 * richiederebbe di ricollegarsi): i token di questo sito spariscono comunque
 * dal database, e il grant viene revocato quando se ne va l'ultimo sito.
 */
export async function planExternalTeardown(siteIds: string[], ownerId: string): Promise<ExternalTeardownPlan> {
  const monitors = await prisma.monitoringConfig.findMany({
    where: { siteId: { in: siteIds }, monitorId: { not: null } },
    select: { monitorId: true },
  });
  const monitorIds = monitors.map((m) => m.monitorId).filter((id): id is string => !!id);

  const hasToken = [{ refreshToken: { not: null } }, { accessToken: { not: null } }];
  const tokenSelect = { refreshToken: true, accessToken: true } as const;
  const otherSites = { site: { ownerId }, siteId: { notIn: siteIds } };

  const [analytics, searchConsole, analyticsOthers, searchConsoleOthers] = await Promise.all([
    prisma.analyticsConnection.findMany({ where: { siteId: { in: siteIds }, OR: hasToken }, select: tokenSelect }),
    prisma.searchConsoleConnection.findMany({ where: { siteId: { in: siteIds }, OR: hasToken }, select: tokenSelect }),
    prisma.analyticsConnection.count({ where: { ...otherSites, OR: hasToken } }),
    prisma.searchConsoleConnection.count({ where: { ...otherSites, OR: hasToken } }),
  ]);

  const googleTokens: ExternalTeardownPlan["googleTokens"] = [];
  const addTokens = (
    provider: GoogleOAuthProvider,
    rows: { refreshToken: string | null; accessToken: string | null }[],
    othersStillConnected: number
  ) => {
    if (othersStillConnected > 0) return;
    for (const token of new Set(rows.map((r) => r.refreshToken ?? r.accessToken).filter((t): t is string => !!t))) {
      googleTokens.push({ provider, token });
    }
  };
  addTokens("analytics", analytics, analyticsOthers);
  addTokens("search-console", searchConsole, searchConsoleOthers);

  return { monitorIds, googleTokens };
}

async function cleanupMonitor(monitorId: string): Promise<boolean> {
  try {
    const result = await deleteMonitor(monitorId);
    if (result.ok) {
      await prisma.monitorCleanup.deleteMany({ where: { monitorId } });
      return true;
    }
    await prisma.monitorCleanup.updateMany({
      where: { monitorId },
      data: { attempts: { increment: 1 }, lastError: result.error.slice(0, 300) },
    });
  } catch (err) {
    console.error(`[teardown] pulizia del monitor ${monitorId} non riuscita:`, err instanceof Error ? err.message : err);
  }
  return false;
}

/** Best effort: non lancia mai, cosi' un problema esterno non fa fallire un'eliminazione gia' avvenuta. */
export async function runExternalTeardown(plan: ExternalTeardownPlan): Promise<void> {
  const work = Promise.allSettled([
    ...plan.monitorIds.map(cleanupMonitor),
    ...plan.googleTokens.map(async ({ provider, token }) => {
      const result = await revokeGoogleToken(token);
      if (!result.ok) console.error(`[teardown] revoca del grant Google (${provider}) non riuscita: ${result.error}`);
    }),
  ]);
  await Promise.race([work, new Promise<void>((resolve) => setTimeout(resolve, EXTERNAL_CLEANUP_TIMEOUT_MS))]);
}

function cleanupQueueOps(plan: ExternalTeardownPlan): Prisma.PrismaPromise<unknown>[] {
  return plan.monitorIds.length > 0
    ? [prisma.monitorCleanup.createMany({ data: plan.monitorIds.map((monitorId) => ({ monitorId })), skipDuplicates: true })]
    : [];
}

export async function deleteSiteWithTeardown(siteId: string, ownerId: string): Promise<void> {
  const plan = await planExternalTeardown([siteId], ownerId);
  await prisma.$transaction([...cleanupQueueOps(plan), prisma.site.delete({ where: { id: siteId } })]);
  await runExternalTeardown(plan);
}

export async function deleteUserWithTeardown(userId: string): Promise<void> {
  const sites = await prisma.site.findMany({ where: { ownerId: userId }, select: { id: true } });
  const plan = await planExternalTeardown(
    sites.map((s) => s.id),
    userId
  );
  await prisma.$transaction([...cleanupQueueOps(plan), prisma.user.delete({ where: { id: userId } })]);
  await runExternalTeardown(plan);
}

/** Chiamata dal cron giornaliero: riprova i monitor che non era stato possibile eliminare subito. */
export async function retryPendingMonitorCleanups(limit = 25): Promise<{ attempted: number; cleaned: number }> {
  const pending = await prisma.monitorCleanup.findMany({
    where: { attempts: { lt: MAX_CLEANUP_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const outcomes = await Promise.all(pending.map((p) => cleanupMonitor(p.monitorId)));
  return { attempted: pending.length, cleaned: outcomes.filter(Boolean).length };
}
