import { prisma } from "@/lib/db/prisma";
import { getValidAnalyticsToken } from "./google-connection";
import { listGa4Properties, getGa4Summary, type Ga4Summary, type Ga4Property } from "@/lib/integrations/google-analytics";

const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Cache in-memory del riepilogo dati (stesso limite gia' accettato per
 * Search Console e Observability: per-istanza, si azzera a ogni cold
 * start). Serve a non rifare 3 chiamate runReport a ogni apertura della
 * tab.
 */
const summaryCache = new Map<string, { expiresAt: number; propertyId: string; summary: Ga4Summary }>();

export interface AnalyticsPanelData {
  connected: boolean;
  propertyId: string | null;
  propertyName: string | null;
  properties: Ga4Property[] | null; // presente se manca la proprieta' o l'utente vuole cambiarla; [] = nessuna proprieta' accessibile
  summary: Ga4Summary | null;
  error: string | null;
  reauthRequired: boolean;
}

function honest(partial: Partial<AnalyticsPanelData>): AnalyticsPanelData {
  return {
    connected: false,
    propertyId: null,
    propertyName: null,
    properties: null,
    summary: null,
    error: null,
    reauthRequired: false,
    ...partial,
  };
}

/**
 * Stato completo della tab Web Analytics per un sito: se non c'e'
 * connessione, se serve scegliere una proprieta', o i dati reali —
 * mai un placeholder o un numero inventato in nessuno dei tre casi.
 */
export async function loadAnalyticsPanel(
  siteId: string,
  options: { forceSelection?: boolean } = {}
): Promise<AnalyticsPanelData> {
  const connection = await prisma.analyticsConnection.findUnique({ where: { siteId } });
  if (!connection?.connected) return honest({ connected: false });

  const identity = { propertyId: connection.propertyId, propertyName: connection.propertyName };

  const tokenResult = await getValidAnalyticsToken(siteId);
  if (!tokenResult.ok) {
    return honest({
      ...identity,
      connected: !tokenResult.reauthRequired,
      error: tokenResult.error,
      reauthRequired: tokenResult.reauthRequired,
    });
  }

  // forceSelection: l'utente ha chiesto di cambiare proprieta' anche se ne
  // ha gia' una scelta (propertyId resta valorizzato finche' non ne sceglie
  // un'altra).
  if (!connection.propertyId || options.forceSelection) {
    const propertiesResult = await listGa4Properties(tokenResult.accessToken);
    if (!propertiesResult.ok) {
      return honest({
        ...identity,
        connected: true,
        reauthRequired: propertiesResult.unauthorized,
        error: propertiesResult.error,
      });
    }
    return honest({ ...identity, connected: true, properties: propertiesResult.properties });
  }

  const cached = summaryCache.get(siteId);
  if (cached && cached.propertyId === connection.propertyId && cached.expiresAt > Date.now()) {
    return honest({ ...identity, connected: true, summary: cached.summary });
  }

  const summaryResult = await getGa4Summary(tokenResult.accessToken, connection.propertyId);
  if (!summaryResult.ok) {
    return honest({
      ...identity,
      connected: true,
      reauthRequired: summaryResult.unauthorized,
      error: summaryResult.error,
    });
  }

  summaryCache.set(siteId, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    propertyId: connection.propertyId,
    summary: summaryResult.summary,
  });
  return honest({ ...identity, connected: true, summary: summaryResult.summary });
}

export type SelectPropertyResult =
  | { ok: true }
  | { ok: false; status: number; error: string; reauthRequired: boolean };

/**
 * Salva la proprieta' GA4 scelta dall'utente, dopo aver verificato con
 * accountSummaries che sia davvero tra quelle dell'account collegato:
 * cosi' un id arbitrario o di un altro account non viene mai persistito.
 * Il nome leggibile viene preso da Google, non dal client.
 */
export async function selectAnalyticsProperty(siteId: string, propertyId: string): Promise<SelectPropertyResult> {
  const tokenResult = await getValidAnalyticsToken(siteId);
  if (!tokenResult.ok) {
    return { ok: false, status: 409, error: tokenResult.error, reauthRequired: tokenResult.reauthRequired };
  }

  const propertiesResult = await listGa4Properties(tokenResult.accessToken);
  if (!propertiesResult.ok) {
    return {
      ok: false,
      status: propertiesResult.unauthorized ? 409 : 502,
      error: propertiesResult.error,
      reauthRequired: propertiesResult.unauthorized,
    };
  }

  const chosen = propertiesResult.properties.find((p) => p.propertyId === propertyId);
  if (!chosen) {
    return {
      ok: false,
      status: 400,
      error: "La proprieta' scelta non e' tra quelle dell'account Google collegato.",
      reauthRequired: false,
    };
  }

  await prisma.analyticsConnection.update({
    where: { siteId },
    data: { propertyId: chosen.propertyId, propertyName: chosen.displayName },
  });
  summaryCache.delete(siteId);
  return { ok: true };
}

/**
 * Da chiamare subito dopo una (ri)connessione OAuth: la proprieta'
 * salvata resta solo se il nuovo account la ha ancora tra quelle
 * accessibili, altrimenti viene azzerata e l'utente dovra' sceglierla di
 * nuovo (lo scope analytics.readonly non espone l'identita' dell'account,
 * quindi il criterio e' il risultato). Se accountSummaries fallisce non
 * possiamo verificarla e la azzeriamo per prudenza.
 */
export async function reconcileSelectedAnalyticsProperty(siteId: string, accessToken: string): Promise<void> {
  summaryCache.delete(siteId);
  const connection = await prisma.analyticsConnection.findUnique({ where: { siteId } });
  if (!connection?.propertyId) return;

  const propertiesResult = await listGa4Properties(accessToken);
  const stillValid =
    propertiesResult.ok && propertiesResult.properties.some((p) => p.propertyId === connection.propertyId);
  if (!stillValid) {
    await prisma.analyticsConnection.update({ where: { siteId }, data: { propertyId: null, propertyName: null } });
  }
}
