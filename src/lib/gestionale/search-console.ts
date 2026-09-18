import { prisma } from "@/lib/db/prisma";
import { getValidSearchConsoleToken } from "./google-connection";
import { listSearchConsoleSites, getSearchConsoleSummary, type SearchConsoleSummary, type SearchConsoleSite } from "@/lib/integrations/search-console";

const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Cache in-memory del riepilogo dati (stesso limite gia' accettato per
 * Observability, vedi src/lib/gestionale/observability.ts: per-istanza,
 * si azzera a ogni cold start). Qui serve soprattutto a non rifare 3
 * chiamate a searchanalytics.query a ogni apertura della tab.
 */
const summaryCache = new Map<string, { expiresAt: number; summary: SearchConsoleSummary }>();

export interface SearchConsolePanel {
  connected: boolean;
  siteUrl: string | null;
  properties: SearchConsoleSite[] | null; // presente se manca la proprieta' o l'utente vuole cambiarla; [] = nessuna proprieta' verificata
  summary: SearchConsoleSummary | null;
  error: string | null;
  reauthRequired: boolean;
}

function honest(partial: Partial<SearchConsolePanel>): SearchConsolePanel {
  return {
    connected: false,
    siteUrl: null,
    properties: null,
    summary: null,
    error: null,
    reauthRequired: false,
    ...partial,
  };
}

/**
 * Stato completo della tab Search Console per un sito: se non c'e'
 * connessione, se serve scegliere una proprieta', o i dati reali —
 * mai un placeholder o un numero inventato in nessuno dei tre casi.
 */
export async function loadSearchConsolePanel(
  siteId: string,
  options: { forceSelection?: boolean } = {}
): Promise<SearchConsolePanel> {
  const connection = await prisma.searchConsoleConnection.findUnique({ where: { siteId } });
  if (!connection?.connected) return honest({ connected: false });

  const tokenResult = await getValidSearchConsoleToken(siteId);
  if (!tokenResult.ok) {
    return honest({ connected: !tokenResult.reauthRequired, error: tokenResult.error, reauthRequired: tokenResult.reauthRequired });
  }

  // forceSelection: l'utente ha chiesto di cambiare proprieta' anche se ne
  // ha gia' una scelta (siteUrl resta valorizzato finche' non ne sceglie
  // un'altra).
  if (!connection.siteUrl || options.forceSelection) {
    const sitesResult = await listSearchConsoleSites(tokenResult.accessToken);
    if (!sitesResult.ok) {
      return honest({
        connected: true,
        siteUrl: connection.siteUrl,
        reauthRequired: sitesResult.unauthorized,
        error: sitesResult.error,
      });
    }
    // siteUnverifiedUser: l'account e' elencato ma non ha verificato la
    // proprieta', quindi Google rifiuta le query dati — non ha senso
    // proporla come scelta.
    const selectable = sitesResult.sites.filter((s) => s.permissionLevel !== "siteUnverifiedUser");
    return honest({ connected: true, siteUrl: connection.siteUrl, properties: selectable });
  }

  const cached = summaryCache.get(siteId);
  if (cached && cached.expiresAt > Date.now()) {
    return honest({ connected: true, siteUrl: connection.siteUrl, summary: cached.summary });
  }

  const summaryResult = await getSearchConsoleSummary(tokenResult.accessToken, connection.siteUrl);
  if (!summaryResult.ok) {
    return honest({
      connected: true,
      siteUrl: connection.siteUrl,
      reauthRequired: summaryResult.unauthorized,
      error: summaryResult.error,
    });
  }

  summaryCache.set(siteId, { expiresAt: Date.now() + CACHE_TTL_MS, summary: summaryResult.summary });
  return honest({ connected: true, siteUrl: connection.siteUrl, summary: summaryResult.summary });
}

export type SelectPropertyResult =
  | { ok: true }
  | { ok: false; status: number; error: string; reauthRequired: boolean };

/**
 * Salva la proprieta' Search Console scelta dall'utente, dopo aver
 * verificato con sites.list che sia davvero tra quelle (verificate)
 * dell'account collegato: cosi' un valore arbitrario o di un altro
 * account non viene mai persistito.
 */
export async function selectSearchConsoleProperty(siteId: string, siteUrl: string): Promise<SelectPropertyResult> {
  const tokenResult = await getValidSearchConsoleToken(siteId);
  if (!tokenResult.ok) {
    return { ok: false, status: 409, error: tokenResult.error, reauthRequired: tokenResult.reauthRequired };
  }

  const sitesResult = await listSearchConsoleSites(tokenResult.accessToken);
  if (!sitesResult.ok) {
    return {
      ok: false,
      status: sitesResult.unauthorized ? 409 : 502,
      error: sitesResult.error,
      reauthRequired: sitesResult.unauthorized,
    };
  }

  const allowed = sitesResult.sites.some((s) => s.siteUrl === siteUrl && s.permissionLevel !== "siteUnverifiedUser");
  if (!allowed) {
    return {
      ok: false,
      status: 400,
      error: "La proprieta' scelta non e' tra quelle verificate dell'account Google collegato.",
      reauthRequired: false,
    };
  }

  await prisma.searchConsoleConnection.update({ where: { siteId }, data: { siteUrl } });
  summaryCache.delete(siteId);
  return { ok: true };
}

/**
 * Da chiamare subito dopo una (ri)connessione OAuth: la proprieta'
 * salvata resta solo se il nuovo account la ha ancora tra quelle
 * verificate, altrimenti viene azzerata e l'utente dovra' sceglierla di
 * nuovo. Non conosciamo l'identita' dell'account Google (lo scope e'
 * solo webmasters.readonly, senza email), quindi il criterio e' il
 * risultato: se il nuovo account non vede la proprieta', per lui non e'
 * valida. Se sites.list fallisce non possiamo verificarla e la azzeriamo
 * per prudenza.
 */
export async function reconcileSelectedProperty(siteId: string, accessToken: string): Promise<void> {
  summaryCache.delete(siteId);
  const connection = await prisma.searchConsoleConnection.findUnique({ where: { siteId } });
  if (!connection?.siteUrl) return;

  const sitesResult = await listSearchConsoleSites(accessToken);
  const stillValid =
    sitesResult.ok &&
    sitesResult.sites.some((s) => s.siteUrl === connection.siteUrl && s.permissionLevel !== "siteUnverifiedUser");
  if (!stillValid) {
    await prisma.searchConsoleConnection.update({ where: { siteId }, data: { siteUrl: null } });
  }
}
